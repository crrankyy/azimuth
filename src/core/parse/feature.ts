import { fieldContext, finishSchema, need, opt, r, unknownKeys, type Reader } from "../schema";
import { sectionBody, splitSections } from "../sections";
import {
  IMPACT_CHANGES,
  PRIORITIES,
  SIZES,
  TASK_STATUSES,
  FEATURE_STATUSES,
  type AsBuilt,
  type FeatureDetail,
  type FeatureStatus,
  type ImpactChange,
  type Priority,
  type Problem,
  type ProjectMode,
  type Size,
  type Task,
} from "../types";
import { problem, readFrontmatter } from "./common";

export interface Override {
  gate: string;
  reason: string;
  at: string;
}

export interface FeatureHeader {
  id: string;
  title: string;
  summary: string;
  status: FeatureStatus;
  priority: Priority;
  size: Size | null;
  mode: ProjectMode;
  milestone: string | null;
  depends_on: string[];
  superseded_by: string | null;
  tags: string[];
  created: string;
  updated: string;
  approved_at: string | null;
  approved_by: "you" | "agent" | null;
  approved_hash: string | null;
  approved_commit: string | null;
  review_ack_at: string | null;
  overrides: Override[];
  context: FeatureDetail["context"];
  /** feature.md without frontmatter, for the spec hash. */
  body: string;
  keyLines: Record<string, number>;
}

const FEATURE_KEYS = [
  "id",
  "title",
  "summary",
  "status",
  "priority",
  "size",
  "mode",
  "milestone",
  "depends_on",
  "superseded_by",
  "tags",
  "created",
  "updated",
  "approved_at",
  "approved_by",
  "approved_hash",
  "approved_commit",
  "review_ack_at",
  "overrides",
] as const;

const overridesReader: Reader<Override[]> = (v) => {
  if (v === null || v === undefined) return { ok: true, value: [] };
  const valid =
    Array.isArray(v) &&
    v.every(
      (o) =>
        o &&
        typeof o === "object" &&
        typeof (o as Override).gate === "string" &&
        typeof (o as Override).reason === "string",
    );
  if (!valid) return { ok: false, expected: "a list of {gate, reason, at}" };
  return {
    ok: true,
    value: (v as Override[]).map((o) => ({
      gate: o.gate,
      reason: o.reason,
      at: String(o.at ?? ""),
    })),
  };
};

export function parseFeatureMd(
  text: string,
  file: string,
): { header: FeatureHeader | null; problems: Problem[] } {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { header: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const header: FeatureHeader = {
    id: need(ctx, "id", r.id("feature"), ""),
    title: need(ctx, "title", r.string(), ""),
    summary: opt(ctx, "summary", r.string(), ""),
    status: need(ctx, "status", r.oneOf(FEATURE_STATUSES), "idea"),
    priority: opt(ctx, "priority", r.oneOf(PRIORITIES), "P2"),
    size: opt(ctx, "size", r.nullable(r.oneOf(SIZES)), null),
    mode: opt(ctx, "mode", r.oneOf(["greenfield", "brownfield"] as const), "brownfield"),
    milestone: opt(ctx, "milestone", r.nullable(r.id("milestone")), null),
    depends_on: opt(ctx, "depends_on", r.ids("feature"), []),
    superseded_by: opt(ctx, "superseded_by", r.nullable(r.id("feature")), null),
    tags: opt(ctx, "tags", r.strings(), []),
    created: need(ctx, "created", r.date(), ""),
    updated: opt(ctx, "updated", r.date(), ""),
    approved_at: opt(ctx, "approved_at", r.nullable(r.date()), null),
    approved_by: opt(ctx, "approved_by", r.nullable(r.oneOf(["you", "agent"] as const)), null),
    approved_hash: opt(ctx, "approved_hash", r.nullable(r.string()), null),
    approved_commit: opt(ctx, "approved_commit", r.nullable(r.text()), null),
    review_ack_at: opt(ctx, "review_ack_at", r.nullable(r.datetime()), null),
    overrides: opt(ctx, "overrides", overridesReader, []),
    context: contextSections(fm.body),
    body: fm.body,
    keyLines: fm.keyLines,
  };
  if (!header.updated) header.updated = header.created;
  unknownKeys(ctx, FEATURE_KEYS);
  return { header: ctx.failed ? null : header, problems: [...problems, ...finishSchema(ctx)] };
}

function contextSections(body: string): FeatureDetail["context"] {
  const { sections } = splitSections(body);
  return {
    objective: sectionBody(sections, "Objective"),
    out_of_scope: sectionBody(sections, "Out of scope"),
    integration_points: sectionBody(sections, "Integration points"),
    invariants: sectionBody(sections, "Invariants"),
    assumptions: sectionBody(sections, "Assumptions"),
  };
}

export interface ImpactRaw {
  path: string;
  change: ImpactChange;
  note: string;
  symbols: string[];
}

export function parseImpact(
  text: string,
  file: string,
  ref: string,
): { files: ImpactRaw[]; problems: Problem[] } {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { files: [], problems };
  const raw = fm.data.files;
  if (raw === undefined || raw === null) return { files: [], problems };
  const line = fm.keyLines.files ?? null;
  if (!Array.isArray(raw)) {
    return {
      files: [],
      problems: [...problems, problem("E-SCHEMA", file, line, "files must be a list.", ref)],
    };
  }
  const files: ImpactRaw[] = [];
  raw.forEach((item, i) => {
    const entry = item as Record<string, unknown> | null;
    const path = typeof entry?.path === "string" ? entry.path.trim() : "";
    const change = entry?.change;
    if (
      !path ||
      typeof change !== "string" ||
      !(IMPACT_CHANGES as readonly string[]).includes(change)
    ) {
      problems.push(
        problem(
          "E-SCHEMA",
          file,
          line,
          `files[${i}] needs a path and a change (create, modify, read or test).`,
          ref,
        ),
      );
      return;
    }
    const symbols = Array.isArray(entry?.symbols) ? entry.symbols.map(String) : [];
    files.push({
      path,
      change: change as ImpactChange,
      note: typeof entry?.note === "string" ? entry.note : "",
      symbols,
    });
  });
  return { files, problems };
}

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rs: "rust",
  rb: "ruby",
  sh: "bash",
  yml: "yaml",
};

export function parseContract(
  text: string,
  file: string,
): { contract: FeatureDetail["contract"]; problems: Problem[] } {
  const { fm, problems } = readFrontmatter(text, file);
  const { sections } = splitSections(fm.body);
  const declared = typeof fm.data.language === "string" ? fm.data.language : null;
  const fenced = /^\s*```(\w+)/m.exec(fm.body)?.[1] ?? null;
  const raw = declared ?? fenced ?? "";
  return {
    contract: {
      language: LANGUAGE_ALIASES[raw] ?? raw,
      sections: sections.map((s) => ({ title: s.title, body: s.body })),
    },
    problems,
  };
}

export type TaskRaw = Omit<Task, "last_run">;

export function parsePlan(
  text: string,
  file: string,
  featureId: string,
): { tasks: TaskRaw[]; problems: Problem[] } {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { tasks: [], problems };
  const raw = fm.data.tasks;
  const line = fm.keyLines.tasks ?? null;
  if (raw === undefined || raw === null) return { tasks: [], problems };
  if (!Array.isArray(raw)) {
    return {
      tasks: [],
      problems: [...problems, problem("E-SCHEMA", file, line, "tasks must be a list.", featureId)],
    };
  }
  const tasks: TaskRaw[] = [];
  const featureNum = featureId.slice(2);
  raw.forEach((item, i) => {
    const data = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const ctx = fieldContext(file, data, {});
    ctx.ref = typeof data.id === "string" ? data.id : featureId;
    const task: TaskRaw = {
      id: need(ctx, "id", r.id("task"), `T-${featureNum}.?`),
      title: need(ctx, "title", r.string(), ""),
      status: opt(ctx, "status", r.oneOf(TASK_STATUSES), "todo"),
      after: opt(ctx, "after", r.ids("task"), []),
      covers: opt(ctx, "covers", r.ids("scenario"), []),
      files: opt(ctx, "files", r.strings(), []),
      verify: opt(ctx, "verify", r.string(), ""),
      note: opt(ctx, "note", r.nullable(r.string()), null),
    };
    const schemaProblems = ctx.problems.map((p) => ({
      ...p,
      line,
      message: `tasks[${i}]: ${p.message}`,
    }));
    problems.push(...schemaProblems);
    if (ctx.failed) return;
    if (!task.id.startsWith(`T-${featureNum}.`)) {
      problems.push(
        problem(
          "E-ID-MISMATCH",
          file,
          line,
          `${task.id} does not belong to ${featureId}.`,
          task.id,
        ),
      );
    }
    if ((task.status === "blocked" || task.status === "skipped") && !task.note) {
      problems.push(
        problem(
          "E-SCHEMA",
          file,
          line,
          `${task.id} is ${task.status} and needs a note saying why.`,
          task.id,
        ),
      );
    }
    tasks.push(task);
  });
  const ids = tasks.map((t) => t.id);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
    problems.push(problem("E-ID-DUP", file, line, `${id} is defined more than once.`, id));
  }
  return { tasks, problems };
}

export function parseAsBuilt(
  text: string,
  file: string,
  ref: string,
): { asBuilt: AsBuilt | null; problems: Problem[] } {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { asBuilt: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  ctx.ref = ref;
  const list = (key: string) => (Array.isArray(fm.data[key]) ? (fm.data[key] as unknown[]) : []);
  const asBuilt: AsBuilt = {
    completed_at: need(ctx, "completed_at", r.date(), ""),
    files_changed: list("files_changed").map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return { path: String(o.path ?? ""), change: String(o.change ?? "") };
    }),
    deviations: list("deviations").map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        path: String(o.path ?? ""),
        kind: String(o.kind ?? ""),
        reason: String(o.reason ?? ""),
      };
    }),
    follow_ups: opt(ctx, "follow_ups", r.ids("issue", "feature", "decision", "question"), []),
    body: fm.body.trim(),
  };
  return { asBuilt: ctx.failed ? null : asBuilt, problems: [...problems, ...finishSchema(ctx)] };
}
