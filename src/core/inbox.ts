import type { Derived } from "./derive";
import { gatePasses, type GateContext, nextGate } from "./gates";
import type { FeatureEntity } from "./model";
import { INBOX_KINDS, type InboxItem, type Urgency } from "./types";

const URGENCY_ORDER: Urgency[] = ["high", "normal", "low"];

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function lastTransitionInto(f: FeatureEntity, status: string): string | null {
  const entry = [...f.log].reverse().find((e) => e.transition?.to === status);
  return entry?.at ?? null;
}

/** Things that need the human, derived from the files (§18.2 plus review-auto). */
export function buildInbox(ctx: GateContext, derived: Derived): InboxItem[] {
  const { model, facts } = ctx;
  const items: InboxItem[] = [];
  const now = facts.now.toISOString().replace(/\.\d{3}Z$/, "Z");

  for (const q of model.questions) {
    if (q.status !== "open") continue;
    const feature = q.feature ? derived.features.get(q.feature) : undefined;
    let detail: string;
    if (q.blocking && q.feature) {
      const verb = feature?.status === "draft" ? "be approved" : "move forward";
      detail = `Blocking: ${q.feature} can't ${verb} until this is answered.`;
    } else {
      const tasks = q.links.filter((l) => l.startsWith("T-"));
      const target =
        tasks.length > 0 && q.feature
          ? `${tasks.join(", ")} in ${q.feature}`
          : (q.feature ?? q.links[0]);
      detail = target ? `Affects ${target}. Not blocking.` : "Not blocking.";
    }
    items.push({
      kind: "answer-question",
      ref: q.id,
      title: q.title,
      detail,
      since: q.raised_at,
      urgency: q.blocking ? "high" : "normal",
    });
  }

  for (const f of model.features) {
    const info = derived.info.get(f.id);
    if (!info) continue;
    if (f.status === "verifying" || f.status === "in-progress") {
      const failing = f.tasks
        .filter((t) => f.status === "verifying" || t.status === "done")
        .map((t) => ({ task: t, run: derived.lastRun.get(t.id) }))
        .filter((x) => x.run && !x.run.ok);
      const first = failing[0];
      if (first?.run) {
        items.push({
          kind: "failing-verify",
          ref: f.id,
          title:
            failing.length === 1
              ? `${first.task.id} verify failed`
              : `${failing.length} task verifies failed`,
          detail: `\`${first.run.command}\` exited ${first.run.exit_code} (run ${first.run.id}).`,
          since: first.run.at,
          urgency: "high",
        });
      }
    }
    if (info.modified_since_approval) {
      const change = info.approval_changes[0];
      const who = f.approved_by === "agent" ? "it was approved" : "you approved it";
      const name = change?.path.split("/").pop();
      const detail = !change
        ? "The spec changed after approval."
        : change.commit
          ? `${name} was edited on ${(change.at ?? "").slice(0, 10)}${change.session ? ` by ${change.session}` : ` in ${change.commit}`}.`
          : `${name} has uncommitted changes.`;
      items.push({
        kind: "reapprove-spec",
        ref: f.id,
        title: `${f.title} changed since ${who}`,
        detail,
        since: change?.at ?? info.last_activity ?? now,
        urgency: "high",
      });
    }
    if (f.status === "draft" && model.config.autonomy.approve_specs === "manual") {
      const gate = nextGate(ctx, f);
      if (gatePasses(gate) && gate) {
        const scenarios = f.stories.reduce((n, s) => n + s.scenarios.length, 0);
        items.push({
          kind: "approve-spec",
          ref: f.id,
          title: `${f.title} is ready for approval`,
          detail: `All ${gate.checks.length} approval checks pass. ${plural(f.stories.length, "story", "stories")}, ${plural(scenarios, "scenario")}, ${plural(f.tasks.length, "task")}.`,
          since: lastTransitionInto(f, "draft") ?? `${f.updated}T00:00:00Z`,
          urgency: "normal",
        });
      }
    }
    if (info.stale) {
      items.push({
        kind: "stale",
        ref: f.id,
        title: `${f.title} has gone quiet`,
        detail: `No activity since ${(info.last_activity ?? f.updated).slice(0, 10)}.`,
        since: info.last_activity ?? `${f.updated}T00:00:00Z`,
        urgency: "low",
      });
    }
    if (
      f.approved_by === "agent" &&
      !f.review_ack_at &&
      ["approved", "in-progress", "verifying", "done"].includes(f.status)
    ) {
      items.push({
        kind: "review-auto",
        ref: f.id,
        title: `${f.title} was approved automatically`,
        detail:
          "An agent approved this spec when every check passed. Acknowledge it or send it back to draft.",
        since: lastTransitionInto(f, "approved") ?? `${f.approved_at ?? f.updated}T00:00:00Z`,
        urgency: "low",
      });
    }
  }

  for (const d of model.decisions) {
    if (d.status === "proposed" && model.config.autonomy.accept_adrs === "manual") {
      const session = model.sessions.find((s) => s.raised.includes(d.id));
      const blockedTasks = model.features
        .flatMap((f) => f.tasks)
        .filter((t) => t.status === "blocked" && t.note?.includes(d.id));
      const parts = [session ? `Proposed by ${session.id}.` : "Proposed."];
      if (blockedTasks.length > 0) {
        parts.push(
          `${blockedTasks.map((t) => t.id).join(", ")} ${blockedTasks.length === 1 ? "is" : "are"} blocked until it's decided.`,
        );
      }
      items.push({
        kind: "review-adr",
        ref: d.id,
        title: d.title,
        detail: parts.join(" "),
        since: session?.started_at ?? `${d.date}T00:00:00Z`,
        urgency: "normal",
      });
    }
    if (d.status === "accepted" && d.decided_by === "agent" && !d.review_ack_at) {
      items.push({
        kind: "review-auto",
        ref: d.id,
        title: `${d.title} was accepted automatically`,
        detail: "An agent accepted this decision. Acknowledge it or move it back to proposed.",
        since: d.decided_at ?? `${d.date}T00:00:00Z`,
        urgency: "low",
      });
    }
  }

  const errors = ctx.problems.filter((p) => p.severity === "error");
  if (errors.length > 0) {
    items.push({
      kind: "check-errors",
      ref: null,
      title: plural(errors.length, "validation error"),
      detail: errors[0]?.message ?? "",
      since: now,
      urgency: "normal",
    });
  }

  return items.sort(
    (a, b) =>
      URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency) ||
      INBOX_KINDS.indexOf(a.kind) - INBOX_KINDS.indexOf(b.kind) ||
      Date.parse(a.since) - Date.parse(b.since),
  );
}
