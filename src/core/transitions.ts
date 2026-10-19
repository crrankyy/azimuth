import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeProject } from "./build-index";
import { loadConfig } from "./config";
import { AzimuthError } from "./errors";
import { updateFrontmatter, updateFrontmatterItem } from "./frontmatter";
import { evaluateGate, NEXT_STATUS, type GateContext } from "./gates";
import { toUtc } from "./git";
import { DECISION_FLOW, FEATURE_FLOW, ISSUE_FLOW, MILESTONE_FLOW, TASK_FLOW } from "./flows";
import { featureOf, idKind } from "./ids";
import { withLock, writeFileAtomic } from "./lock";
import type { FeatureEntity } from "./model";
import { formatLogHeader } from "./parse/log";
import { specHash } from "./spec-hash";
import {
  FEATURE_STATUSES,
  ISSUE_STATUSES,
  MILESTONE_STATUSES,
  PRIORITIES,
  SEVERITIES,
  SIZES,
  TASK_STATUSES,
  type Actor,
  type DecisionStatus,
  type FeatureStatus,
  type Gate,
  type IssueStatus,
  type LogType,
  type MilestoneStatus,
  type TaskStatus,
} from "./types";

export interface Who {
  actor: Actor;
  session?: string | null;
  now?: Date;
}

export interface MoveOptions extends Who {
  reason?: string;
  /** Override the dependency check of G-START (you only). */
  override?: boolean;
  supersededBy?: string;
  /** Why a task is blocked or skipped. */
  note?: string;
  /** For viewer actions: the status the user saw; a different current status is a conflict. */
  expectStatus?: string;
}

export interface Result {
  ref: string;
  from: string | null;
  to: string | null;
  /** Repo-relative files written. */
  changed: string[];
  auto: boolean;
  message: string;
}

const stamp = (now: Date) => toUtc(now.toISOString());
const today = (now: Date) => now.toISOString().slice(0, 10);

interface Write {
  file: string;
  text: string;
}

function read(root: string, file: string): string {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    throw new AzimuthError("not-found", `${file} does not exist.`);
  }
}

function readOr(root: string, file: string, fallback: string): string {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return fallback;
  }
}

function save(root: string, writes: Write[]): string[] {
  for (const w of writes) writeFileAtomic(join(root, w.file), w.text);
  return writes.map((w) => w.file);
}

/** Appends one log entry, separated from the previous one by a blank line. */
export function appendLogText(
  existing: string,
  entry: {
    at: string;
    actor: Actor;
    type: LogType;
    session?: string | null;
    auto?: boolean;
    body: string;
  },
): string {
  const base = existing.trim() === "" ? "# Log\n" : existing.replace(/\s*$/, "\n");
  return `${base}\n${formatLogHeader(entry)}\n${entry.body.trim()}\n`;
}

const STATUS_NOTES = "## Status notes";

/**
 * Adds a bullet to the body's "Status notes" section, creating the section at the end when it is
 * missing. Issues have no log, so the reasons given for their moves are kept here.
 */
export function addStatusNote(text: string, note: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.replace(/(\r?\n)+$/, "").split(/\r?\n/);
  const bodyStart = lines[0] === "---" ? lines.indexOf("---", 1) + 1 : 0;
  const heading = lines.indexOf(STATUS_NOTES, bodyStart);
  const bullet = `- ${note.trim().split(/\r?\n/).join(`${eol}  `)}`;
  if (heading === -1) return [...lines, "", STATUS_NOTES, bullet, ""].join(eol);
  let end = lines.findIndex((line, i) => i > heading && line.startsWith("## "));
  if (end === -1) end = lines.length;
  while (end > heading + 1 && (lines[end - 1] ?? "").trim() === "") end--;
  lines.splice(end, 0, bullet);
  return lines.join(eol) + eol;
}

function logWrite(
  root: string,
  f: FeatureEntity,
  entry: Parameters<typeof appendLogText>[1],
): Write {
  const file = f.files.log ?? `${f.dir}log.md`;
  return { file, text: appendLogText(readOr(root, file, ""), entry) };
}

function featureById(ctx: GateContext, id: string): FeatureEntity {
  const f = ctx.derived.features.get(id);
  if (!f)
    throw new AzimuthError(
      "not-found",
      `${id} does not exist (or has errors that keep it out of the index; run \`azimuth check\`).`,
    );
  return f;
}

function requireReason(reason: string | undefined, what: string): string {
  if (!reason?.trim()) throw new AzimuthError("invalid", `${what} needs a reason (--reason "…").`);
  return reason.trim();
}

function checkExpected(current: string, expected: string | undefined, ref: string): void {
  if (expected !== undefined && expected !== current) {
    throw new AzimuthError(
      "conflict",
      `${ref} is now ${current}, not ${expected}. Reload to see the latest state.`,
    );
  }
}

function failGate(ref: string, gate: Gate): never {
  const failing = gate.checks
    .filter((c) => !c.ok)
    .map((c) => `${c.rule}${c.detail ? ` (${c.detail})` : ""}`);
  throw new AzimuthError("gate", `${ref} cannot move to ${gate.to}: ${failing.join("; ")}.`, gate);
}

/** Moves any entity with a lifecycle; dispatches on the ID's kind. */
export function move(root: string, ref: string, to: string, opts: MoveOptions): Result {
  switch (idKind(ref)) {
    case "feature":
      return moveFeature(root, ref, to, opts);
    case "task":
      return moveTask(root, ref, to, opts);
    case "decision":
      return moveDecision(root, ref, to, opts);
    case "milestone":
      return moveMilestone(root, ref, to, opts);
    case "issue":
      return moveIssue(root, ref, to, opts);
    case "question":
      if (to === "obsolete") return obsoleteQuestion(root, ref, opts);
      throw new AzimuthError(
        "invalid",
        `Questions are answered with \`azimuth answer ${ref}\`, not moved to ${to}.`,
      );
    default:
      throw new AzimuthError("invalid", `${ref} is not an ID that has a status.`);
  }
}

const isForward = (from: FeatureStatus, to: FeatureStatus) =>
  NEXT_STATUS[from] === to || (from === "deferred" && to === "draft");

/** Moves that undo progress or park work; they need a reason in the log. */
export function needsReason(from: FeatureStatus, to: FeatureStatus): boolean {
  return (
    to === "deferred" ||
    to === "cancelled" ||
    ((from === "approved" || from === "in-progress") && to === "draft") ||
    (from === "verifying" && to === "in-progress")
  );
}

/**
 * Whether a feature may move from `from` to `to` for this actor and autonomy setting, ignoring
 * gates (which need the project state). Returns the refusal, or null when allowed.
 */
export function featureTransitionError(
  id: string,
  from: FeatureStatus,
  to: FeatureStatus,
  opts: {
    actor: Actor;
    approveSpecs: "auto" | "manual";
    reason?: string;
    override?: boolean;
    supersededBy?: string;
  },
): AzimuthError | null {
  if (!FEATURE_FLOW[from].includes(to)) {
    const allowed = FEATURE_FLOW[from];
    return new AzimuthError(
      "invalid",
      `${id} is ${from}; it can move to ${allowed.length ? allowed.join(", ") : "nothing (final status)"}, not ${to}.`,
    );
  }
  if (to === "approved" && opts.actor === "agent" && opts.approveSpecs === "manual") {
    return new AzimuthError(
      "policy",
      `Spec approval is manual in this project. Ask the user to approve ${id} in the viewer.`,
    );
  }
  if (opts.override && opts.actor !== "you")
    return new AzimuthError("policy", "Only you can override a gate.");
  if (needsReason(from, to) && !opts.reason?.trim()) {
    return new AzimuthError("invalid", `Moving ${id} to ${to} needs a reason (--reason "…").`);
  }
  if (to === "superseded" && !opts.supersededBy) {
    return new AzimuthError("invalid", `Superseding ${id} needs the replacing feature (--by F-…).`);
  }
  return null;
}

export function moveFeature(root: string, id: string, toRaw: string, opts: MoveOptions): Result {
  if (!(FEATURE_STATUSES as readonly string[]).includes(toRaw)) {
    throw new AzimuthError(
      "invalid",
      `Unknown feature status "${toRaw}". Use one of: ${FEATURE_STATUSES.join(", ")}.`,
    );
  }
  const to = toRaw as FeatureStatus;
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { ctx, model, facts } = analyzeProject(root, now);
    const f = featureById(ctx, id);
    const from = f.status;
    checkExpected(from, opts.expectStatus, id);
    const refusal = featureTransitionError(id, from, to, {
      actor: opts.actor,
      approveSpecs: model.config.autonomy.approve_specs,
      reason: opts.reason,
      override: opts.override,
      supersededBy: opts.supersededBy,
    });
    if (refusal) throw refusal;
    const forward = isForward(from, to);
    const backward = (from === "approved" || from === "in-progress") && to === "draft";
    const reason = opts.reason?.trim() || undefined;

    const updates: Record<string, unknown> = { status: to, updated: today(now) };
    if (forward) {
      const gate = evaluateGate(ctx, f, to);
      if (gate) {
        const failing = gate.checks.filter((c) => !c.ok);
        const overridable =
          to === "in-progress" &&
          opts.override &&
          failing.every((c) => c.id === "start.dependencies-done");
        if (failing.length > 0 && !overridable) failGate(id, gate);
        if (overridable && failing.length > 0) {
          updates.overrides = [
            ...f.overrides,
            {
              gate: "start.dependencies-done",
              reason: requireReason(reason, "An override"),
              at: stamp(now),
            },
          ];
        }
      }
    }
    const auto = to === "approved" && opts.actor === "agent";
    if (to === "approved") {
      Object.assign(updates, {
        approved_at: today(now),
        approved_by: opts.actor,
        approved_hash: f.spec ? specHash(f.spec) : null,
        approved_commit: facts.git.head,
        review_ack_at: null,
      });
    }
    if (backward) {
      Object.assign(updates, {
        approved_at: null,
        approved_by: null,
        approved_hash: null,
        approved_commit: null,
        review_ack_at: null,
      });
    }
    if (to === "superseded") updates.superseded_by = opts.supersededBy;

    const featureText = updateFrontmatter(read(root, f.files.feature), updates);
    const body = `${from} → ${to}${reason ? `\n\n${reason}` : ""}`;
    const changed = save(root, [
      { file: f.files.feature, text: featureText },
      logWrite(root, f, {
        at: stamp(now),
        actor: opts.actor,
        type: "transition",
        session: opts.session ?? null,
        auto,
        body,
      }),
    ]);
    return {
      ref: id,
      from,
      to,
      changed,
      auto,
      message: `${id}: ${from} → ${to}${auto ? " (approved automatically)" : ""}`,
    };
  });
}

/** Re-approves an approved or in-progress feature whose spec changed, re-running G-APPROVE. */
export function reapproveFeature(root: string, id: string, opts: MoveOptions): Result {
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { ctx, model, facts } = analyzeProject(root, now);
    const f = featureById(ctx, id);
    checkExpected(f.status, opts.expectStatus, id);
    if (f.status !== "approved" && f.status !== "in-progress") {
      throw new AzimuthError(
        "invalid",
        `${id} is ${f.status}; only approved or in-progress features can be re-approved.`,
      );
    }
    if (opts.actor === "agent" && model.config.autonomy.approve_specs === "manual") {
      throw new AzimuthError(
        "policy",
        `Spec approval is manual in this project. Ask the user to re-approve ${id}.`,
      );
    }
    const gate = evaluateGate(ctx, f, "approved");
    if (gate && gate.checks.some((c) => !c.ok)) failGate(id, gate);
    const auto = opts.actor === "agent";
    const featureText = updateFrontmatter(read(root, f.files.feature), {
      approved_at: today(now),
      approved_by: opts.actor,
      approved_hash: f.spec ? specHash(f.spec) : null,
      approved_commit: facts.git.head,
      review_ack_at: null,
      updated: today(now),
    });
    const changed = save(root, [
      { file: f.files.feature, text: featureText },
      logWrite(root, f, {
        at: stamp(now),
        actor: opts.actor,
        type: "note",
        session: opts.session ?? null,
        auto,
        body: "Re-approved the changed spec.",
      }),
    ]);
    return { ref: id, from: f.status, to: f.status, changed, auto, message: `${id}: re-approved` };
  });
}

export function moveTask(root: string, taskId: string, toRaw: string, opts: MoveOptions): Result {
  if (!(TASK_STATUSES as readonly string[]).includes(toRaw)) {
    throw new AzimuthError(
      "invalid",
      `Unknown task status "${toRaw}". Use one of: ${TASK_STATUSES.join(", ")}.`,
    );
  }
  const to = toRaw as TaskStatus;
  const now = opts.now ?? new Date();
  const featureId = featureOf(taskId) as string;
  return withLock(root, () => {
    const { ctx } = analyzeProject(root, now);
    const f = featureById(ctx, featureId);
    const task = f.tasks.find((t) => t.id === taskId);
    if (!task || !f.files.plan)
      throw new AzimuthError(
        "not-found",
        `${taskId} is not a task in ${f.files.plan ?? `${f.dir}plan.md`}.`,
      );
    checkExpected(task.status, opts.expectStatus, taskId);
    if (!TASK_FLOW[task.status].includes(to)) {
      throw new AzimuthError(
        "invalid",
        `${taskId} is ${task.status}; it can move to ${TASK_FLOW[task.status].join(", ")}, not ${to}.`,
      );
    }
    if ((to === "in-progress" || to === "done") && f.status !== "in-progress") {
      throw new AzimuthError(
        "invalid",
        `${featureId} is ${f.status}. Move it to in-progress first (\`azimuth move ${featureId} in-progress\`).`,
      );
    }
    const note = (opts.note ?? opts.reason)?.trim() || undefined;
    const updates: Record<string, unknown> = { status: to };
    if (to === "blocked" || to === "skipped")
      updates.note = requireReason(note, `Marking ${taskId} ${to}`);
    else if (task.note && (to === "todo" || to === "in-progress" || to === "done"))
      updates.note = null;
    const planText = updateFrontmatterItem(
      read(root, f.files.plan),
      "tasks",
      (item) => item.id === taskId,
      updates,
    );
    if (planText === null)
      throw new AzimuthError("not-found", `${taskId} is not in ${f.files.plan}.`);
    const writes: Write[] = [{ file: f.files.plan, text: planText }];
    if (to === "done" || to === "blocked" || to === "skipped" || note) {
      const body = `${taskId}: ${task.status} → ${to}${note ? `. ${note}` : ""}`;
      writes.push(
        logWrite(root, f, {
          at: stamp(now),
          actor: opts.actor,
          type: "note",
          session: opts.session ?? null,
          body,
        }),
      );
    }
    const writesFeature = updateFrontmatter(read(root, f.files.feature), { updated: today(now) });
    writes.push({ file: f.files.feature, text: writesFeature });
    return {
      ref: taskId,
      from: task.status,
      to,
      changed: save(root, writes),
      auto: false,
      message: `${taskId}: ${task.status} → ${to}`,
    };
  });
}

export function moveDecision(root: string, id: string, toRaw: string, opts: MoveOptions): Result {
  const to = toRaw as DecisionStatus;
  if (!Object.keys(DECISION_FLOW).includes(to)) {
    throw new AzimuthError(
      "invalid",
      `Unknown decision status "${toRaw}". Use one of: ${Object.keys(DECISION_FLOW).join(", ")}.`,
    );
  }
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const d = model.decisions.find((x) => x.id === id);
    if (!d) throw new AzimuthError("not-found", `${id} does not exist.`);
    checkExpected(d.status, opts.expectStatus, id);
    if (!DECISION_FLOW[d.status].includes(to)) {
      throw new AzimuthError(
        "invalid",
        `${id} is ${d.status}; it can move to ${DECISION_FLOW[d.status].join(", ") || "nothing"}, not ${to}.`,
      );
    }
    const deciding = to === "accepted" || to === "rejected";
    if (deciding && opts.actor === "agent") {
      if (model.config.autonomy.accept_adrs === "manual") {
        throw new AzimuthError(
          "policy",
          `Decisions are accepted manually in this project. Ask the user to review ${id}.`,
        );
      }
      const unanswered = d.resolves.filter(
        (q) => model.questions.find((x) => x.id === q)?.status !== "answered",
      );
      if (to === "accepted" && unanswered.length > 0) {
        throw new AzimuthError(
          "policy",
          `${id} resolves ${unanswered.join(", ")}, which the user hasn't answered yet.`,
        );
      }
      const replaced = d.supersedes
        ? model.decisions.find((x) => x.id === d.supersedes)
        : undefined;
      if (to === "accepted" && replaced?.decided_by === "you") {
        throw new AzimuthError(
          "policy",
          `${id} supersedes ${replaced.id}, which the user accepted. Ask the user to review ${id}.`,
        );
      }
    }
    if (
      d.status === "accepted" &&
      to === "proposed" &&
      (opts.actor !== "you" || d.decided_by !== "agent")
    ) {
      throw new AzimuthError(
        "policy",
        "Only you can move an automatically accepted decision back to proposed.",
      );
    }
    if (
      d.status === "rejected" &&
      to === "proposed" &&
      opts.actor !== "you" &&
      // A rejection with no recorded decider (written by hand, or migrated) counts as yours.
      d.decided_by !== "agent"
    ) {
      throw new AzimuthError(
        "policy",
        `You rejected ${id}; only you can move it back to proposed. Propose a new decision instead.`,
      );
    }
    const updates: Record<string, unknown> = { status: to };
    const writes: Write[] = [];
    if (deciding)
      Object.assign(updates, {
        decided_by: opts.actor,
        decided_at: stamp(now),
        decision_note: opts.note?.trim() || null,
        review_ack_at: null,
      });
    if (to === "proposed")
      Object.assign(updates, {
        decided_by: null,
        decided_at: null,
        decision_note: null,
        review_ack_at: null,
      });
    if (to === "superseded") {
      const by = opts.supersededBy;
      const replacement = model.decisions.find((x) => x.id === by);
      if (!by || !replacement)
        throw new AzimuthError(
          "invalid",
          `Superseding ${id} needs the replacing decision (--by ADR-…).`,
        );
      updates.superseded_by = by;
      if (replacement.supersedes !== id) {
        writes.push({
          file: replacement.file,
          text: updateFrontmatter(read(root, replacement.file), { supersedes: id }),
        });
      }
    }
    writes.unshift({ file: d.file, text: updateFrontmatter(read(root, d.file), updates) });
    const auto = deciding && opts.actor === "agent";
    return {
      ref: id,
      from: d.status,
      to,
      changed: save(root, writes),
      auto,
      message: `${id}: ${d.status} → ${to}${auto ? " (automatically)" : ""}`,
    };
  });
}

export function answerQuestion(
  root: string,
  id: string,
  answer: { option?: string | null; text?: string },
  opts: Who,
): Result {
  const now = opts.now ?? new Date();
  if (opts.actor !== "you")
    throw new AzimuthError(
      "policy",
      `Only the user answers questions. Leave ${id} open and ask them.`,
    );
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const q = model.questions.find((x) => x.id === id);
    if (!q) throw new AzimuthError("not-found", `${id} does not exist.`);
    // An agent's answer is yours to replace; your own answer is final.
    const replacing = q.status === "answered" && q.answer?.by === "agent";
    if (q.status !== "open" && !replacing)
      throw new AzimuthError("conflict", `${id} is already ${q.status}.`);
    const option = answer.option ?? null;
    if (option !== null && !q.options.some((o) => o.key === option)) {
      throw new AzimuthError(
        "invalid",
        `${id} has no option "${option}". Options: ${q.options.map((o) => o.key).join(", ")}.`,
      );
    }
    const text = answer.text?.trim() ?? "";
    if (option === null && text === "")
      throw new AzimuthError("invalid", "An answer needs an option or some text.");
    const updates: Record<string, unknown> = {
      status: "answered",
      answer: { option, text, answered_at: stamp(now), by: "you" },
    };
    // A resolution recorded how the agent's answer was applied; yours has to be applied afresh.
    if (replacing) updates.resolution = null;
    const updated = updateFrontmatter(read(root, q.file), updates);
    return {
      ref: id,
      from: q.status,
      to: "answered",
      changed: save(root, [{ file: q.file, text: updated }]),
      auto: false,
      message: `${id}: answered${replacing ? ", replacing the agent's answer" : ""}`,
    };
  });
}

/**
 * Under autonomy.questions: proceed, answers a question an agent has just raised with its one
 * recommended option (answer.by: agent) and notes it in the feature's log as an automatic
 * decision. Returns null and writes nothing when the question has to wait for you: the mode is
 * ask, the actor is you, or the question is blocking, not open or without exactly one
 * recommended option.
 */
export function proceedWithRecommendation(root: string, id: string, opts: Who): Result | null {
  // Checked before the lock, so a project under ask writes and waits exactly as before.
  if (opts.actor !== "agent" || loadConfig(root).config.autonomy.questions !== "proceed")
    return null;
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { ctx, model } = analyzeProject(root, now);
    const q = model.questions.find((x) => x.id === id);
    if (!q) throw new AzimuthError("not-found", `${id} does not exist.`);
    const recommended = q.options.filter((o) => o.recommended);
    const option = recommended.length === 1 ? recommended[0] : undefined;
    if (!option || q.blocking || q.status !== "open") return null;
    const at = stamp(now);
    const writes: Write[] = [
      {
        file: q.file,
        text: updateFrontmatter(read(root, q.file), {
          status: "answered",
          answer: { option: option.key, text: "", answered_at: at, by: "agent" },
        }),
      },
    ];
    const feature = q.feature ? ctx.derived.features.get(q.feature) : undefined;
    if (feature) {
      writes.push(
        logWrite(root, feature, {
          at,
          actor: "agent",
          type: "note",
          session: opts.session ?? null,
          auto: true,
          body: `${id} answered with its recommendation: ${option.label}`,
        }),
      );
    }
    return {
      ref: id,
      from: "open",
      to: "answered",
      changed: save(root, writes),
      auto: true,
      message: `${id}: answered automatically with its recommendation (${option.key}: ${option.label})`,
    };
  });
}

export function resolveQuestion(
  root: string,
  id: string,
  resolution: { kind: "assumption" | "adr"; ref: string },
  opts: Who,
): Result {
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const q = model.questions.find((x) => x.id === id);
    if (!q) throw new AzimuthError("not-found", `${id} does not exist.`);
    if (q.status !== "answered")
      throw new AzimuthError(
        "invalid",
        `${id} is ${q.status}; only answered questions can be resolved.`,
      );
    const exists =
      resolution.kind === "adr"
        ? model.decisions.some((d) => d.id === resolution.ref)
        : model.features.some((f) => f.id === resolution.ref);
    if (!exists) throw new AzimuthError("not-found", `${resolution.ref} does not exist.`);
    const updated = updateFrontmatter(read(root, q.file), { resolution });
    return {
      ref: id,
      from: "answered",
      to: "answered",
      changed: save(root, [{ file: q.file, text: updated }]),
      auto: false,
      message: `${id}: applied as ${resolution.kind} ${resolution.ref}`,
    };
  });
}

function obsoleteQuestion(root: string, id: string, opts: MoveOptions): Result {
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const q = model.questions.find((x) => x.id === id);
    if (!q) throw new AzimuthError("not-found", `${id} does not exist.`);
    checkExpected(q.status, opts.expectStatus, id);
    if (q.status === "obsolete") throw new AzimuthError("conflict", `${id} is already obsolete.`);
    const updated = updateFrontmatter(read(root, q.file), { status: "obsolete" });
    return {
      ref: id,
      from: q.status,
      to: "obsolete",
      changed: save(root, [{ file: q.file, text: updated }]),
      auto: false,
      message: `${id}: ${q.status} → obsolete`,
    };
  });
}

export function moveMilestone(root: string, id: string, toRaw: string, opts: MoveOptions): Result {
  if (!(MILESTONE_STATUSES as readonly string[]).includes(toRaw)) {
    throw new AzimuthError(
      "invalid",
      `Unknown milestone status "${toRaw}". Use one of: ${MILESTONE_STATUSES.join(", ")}.`,
    );
  }
  const to = toRaw as MilestoneStatus;
  if (to === "released" && opts.actor !== "you")
    throw new AzimuthError("policy", "Only the user releases a milestone.");
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const m = model.milestones.find((x) => x.id === id);
    if (!m) throw new AzimuthError("not-found", `${id} does not exist.`);
    checkExpected(m.status, opts.expectStatus, id);
    if (!MILESTONE_FLOW[m.status].includes(to)) {
      throw new AzimuthError(
        "invalid",
        `${id} is ${m.status}; it can move to ${MILESTONE_FLOW[m.status].join(", ") || "nothing"}, not ${to}.`,
      );
    }
    const updates: Record<string, unknown> = { status: to };
    if (to === "released") updates.released_at = today(now);
    const updated = updateFrontmatter(read(root, m.file), updates);
    return {
      ref: id,
      from: m.status,
      to,
      changed: save(root, [{ file: m.file, text: updated }]),
      auto: false,
      message: `${id}: ${m.status} → ${to}`,
    };
  });
}

export function moveIssue(root: string, id: string, toRaw: string, opts: MoveOptions): Result {
  if (!(ISSUE_STATUSES as readonly string[]).includes(toRaw)) {
    throw new AzimuthError(
      "invalid",
      `Unknown issue status "${toRaw}". Use one of: ${ISSUE_STATUSES.join(", ")}.`,
    );
  }
  const to = toRaw as IssueStatus;
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const issue = model.issues.find((x) => x.id === id);
    if (!issue) throw new AzimuthError("not-found", `${id} does not exist.`);
    checkExpected(issue.status, opts.expectStatus, id);
    if (!ISSUE_FLOW[issue.status].includes(to)) {
      throw new AzimuthError(
        "invalid",
        `${id} is ${issue.status}; it can move to ${ISSUE_FLOW[issue.status].join(", ")}, not ${to}.`,
      );
    }
    if (to === "wontfix") requireReason(opts.reason, `Closing ${id} as wontfix`);
    const closing = to === "resolved" || to === "wontfix";
    const reason = opts.reason?.trim();
    const moved = updateFrontmatter(read(root, issue.file), {
      status: to,
      resolved_at: closing ? today(now) : null,
    });
    const updated = reason
      ? addStatusNote(moved, `${stamp(now)} · ${opts.actor} · ${issue.status} → ${to}: ${reason}`)
      : moved;
    return {
      ref: id,
      from: issue.status,
      to,
      changed: save(root, [{ file: issue.file, text: updated }]),
      auto: false,
      message: `${id}: ${issue.status} → ${to}`,
    };
  });
}

/** Records that you reviewed an automatic approval, acceptance or answer. */
export function acknowledge(root: string, id: string, opts: Who): Result {
  if (opts.actor !== "you")
    throw new AzimuthError("policy", "Only the user acknowledges automatic decisions.");
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const feature = model.features.find((f) => f.id === id);
    const decision = model.decisions.find((d) => d.id === id);
    const question = model.questions.find((q) => q.id === id);
    const file = feature?.files.feature ?? decision?.file ?? question?.file;
    const auto = feature
      ? feature.approved_by === "agent"
      : decision
        ? decision.decided_by === "agent"
        : question?.answer?.by === "agent";
    if (!file || !auto)
      throw new AzimuthError("invalid", `${id} has no automatic decision to acknowledge.`);
    const updated = updateFrontmatter(read(root, file), { review_ack_at: stamp(now) });
    return {
      ref: id,
      from: null,
      to: null,
      changed: save(root, [{ file, text: updated }]),
      auto: false,
      message: `${id}: acknowledged`,
    };
  });
}

const SETTABLE: Record<string, { kinds: string[]; valid: (v: unknown) => boolean; hint: string }> =
  {
    priority: {
      kinds: ["feature"],
      valid: (v) => (PRIORITIES as readonly unknown[]).includes(v),
      hint: PRIORITIES.join(", "),
    },
    size: {
      kinds: ["feature"],
      valid: (v) => v === null || (SIZES as readonly unknown[]).includes(v),
      hint: SIZES.join(", "),
    },
    milestone: {
      kinds: ["feature"],
      valid: (v) => v === null || (typeof v === "string" && /^M-\d{2}$/.test(v)),
      hint: "M-NN or none",
    },
    severity: {
      kinds: ["issue"],
      valid: (v) => (SEVERITIES as readonly unknown[]).includes(v),
      hint: SEVERITIES.join(", "),
    },
  };

/** Sets a plain field (priority, size, milestone, severity). */
export function setField(
  root: string,
  id: string,
  field: string,
  value: string | null,
  opts: Who,
): Result {
  const rule = SETTABLE[field];
  const kind = idKind(id);
  if (!rule || !kind || !rule.kinds.includes(kind)) {
    throw new AzimuthError(
      "invalid",
      `Can't set ${field} on ${id}. Settable: ${Object.keys(SETTABLE).join(", ")}.`,
    );
  }
  if (!rule.valid(value)) throw new AzimuthError("invalid", `${field} must be ${rule.hint}.`);
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { model } = analyzeProject(root, now);
    const file =
      kind === "feature"
        ? model.features.find((f) => f.id === id)?.files.feature
        : model.issues.find((i) => i.id === id)?.file;
    if (!file) throw new AzimuthError("not-found", `${id} does not exist.`);
    if (field === "milestone" && value !== null && !model.milestones.some((m) => m.id === value)) {
      throw new AzimuthError("not-found", `${value} does not exist.`);
    }
    const updates: Record<string, unknown> = { [field]: value };
    if (kind === "feature") updates.updated = today(now);
    const updated = updateFrontmatter(read(root, file), updates);
    return {
      ref: id,
      from: null,
      to: null,
      changed: save(root, [{ file, text: updated }]),
      auto: false,
      message: `${id}: ${field} = ${value ?? "none"}`,
    };
  });
}

/** Adds a note (anyone) or a review comment (you) to a feature's log. */
export function addLogEntry(
  root: string,
  ref: string,
  type: "note" | "review",
  body: string,
  opts: Who,
): Result {
  if (!body.trim()) throw new AzimuthError("invalid", "A log entry needs some text.");
  if (type === "review" && opts.actor !== "you")
    throw new AzimuthError("policy", "Only the user requests changes.");
  const featureId = featureOf(ref);
  if (!featureId)
    throw new AzimuthError("invalid", `${ref} is not a feature, story, scenario or task.`);
  const now = opts.now ?? new Date();
  return withLock(root, () => {
    const { ctx } = analyzeProject(root, now);
    const f = featureById(ctx, featureId);
    const text = ref === featureId ? body : `${ref}: ${body}`;
    const write = logWrite(root, f, {
      at: stamp(now),
      actor: opts.actor,
      type,
      session: opts.session ?? null,
      body: text,
    });
    return {
      ref,
      from: null,
      to: null,
      changed: save(root, [write]),
      auto: false,
      message: `${featureId}: ${type} added`,
    };
  });
}
