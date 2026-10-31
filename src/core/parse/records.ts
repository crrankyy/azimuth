import { ID_PATTERNS, type IdKind } from "../ids";
import { fieldContext, finishSchema, need, opt, r, unknownKeys, type Reader } from "../schema";
import { sectionBody, splitSections, stripTitle } from "../sections";
import {
  DECISION_STATUSES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  LEVELS,
  MILESTONE_STATUSES,
  QUESTION_STATUSES,
  SEVERITIES,
  type Decision,
  type Issue,
  type Milestone,
  type Question,
  type QuestionOption,
  type Session,
} from "../types";
import { readFrontmatter, type Parsed } from "./common";

const ALL_KINDS = Object.keys(ID_PATTERNS) as IdKind[];
const anyIds = () => r.ids(...ALL_KINDS);
/** Who created a record: the session that did, or `you` / `agent` outside a session. */
const author: Reader<string> = (v) =>
  v === "you" || v === "agent" || (typeof v === "string" && ID_PATTERNS.session.test(v))
    ? { ok: true, value: v }
    : { ok: false, expected: `a session ID, "you" or "agent"` };

export type MilestoneRecord = Omit<Milestone, "features" | "progress">;

export function parseMilestone(text: string, file: string): Parsed<MilestoneRecord> {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { entity: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const entity: MilestoneRecord = {
    id: need(ctx, "id", r.id("milestone"), ""),
    title: need(ctx, "title", r.string(), ""),
    status: opt(ctx, "status", r.oneOf(MILESTONE_STATUSES), "planned"),
    target: opt(ctx, "target", r.nullable(r.date()), null),
    released_at: opt(ctx, "released_at", r.nullable(r.date()), null),
    goal: opt(ctx, "goal", r.string(), ""),
    // r.text, not r.string: YAML reads a digits-only SHA such as 1234567 as a number.
    tag: opt(ctx, "tag", r.nullable(r.text()), null),
    released_commit: opt(ctx, "released_commit", r.nullable(r.text()), null),
    file,
  };
  unknownKeys(ctx, [
    "id",
    "title",
    "status",
    "target",
    "released_at",
    "goal",
    "tag",
    "released_commit",
  ]);
  return { entity: ctx.failed ? null : entity, problems: [...problems, ...finishSchema(ctx)] };
}

export function parseDecision(text: string, file: string): Parsed<Decision> {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { entity: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const { sections } = splitSections(fm.body);
  const entity: Decision = {
    id: need(ctx, "id", r.id("decision"), ""),
    title: need(ctx, "title", r.string(), ""),
    status: need(ctx, "status", r.oneOf(DECISION_STATUSES), "proposed"),
    date: need(ctx, "date", r.date(), ""),
    supersedes: opt(ctx, "supersedes", r.nullable(r.id("decision")), null),
    superseded_by: opt(ctx, "superseded_by", r.nullable(r.id("decision")), null),
    resolves: opt(ctx, "resolves", r.ids("question"), []),
    links: opt(ctx, "links", anyIds(), []),
    body: {
      context: sectionBody(sections, "Context"),
      options: sectionBody(sections, "Options"),
      decision: sectionBody(sections, "Decision"),
      consequences: sectionBody(sections, "Consequences"),
    },
    decided_by: opt(ctx, "decided_by", r.nullable(r.oneOf(["you", "agent"] as const)), null),
    decided_at: opt(ctx, "decided_at", r.nullable(r.datetime()), null),
    decision_note: opt(ctx, "decision_note", r.nullable(r.string()), null),
    review_ack_at: opt(ctx, "review_ack_at", r.nullable(r.datetime()), null),
    file,
  };
  unknownKeys(ctx, [
    "id",
    "title",
    "status",
    "date",
    "supersedes",
    "superseded_by",
    "resolves",
    "links",
    "decided_by",
    "decided_at",
    "decision_note",
    "review_ack_at",
  ]);
  return { entity: ctx.failed ? null : entity, problems: [...problems, ...finishSchema(ctx)] };
}

const optionsReader: Reader<QuestionOption[]> = (v) => {
  if (v === null || v === undefined) return { ok: true, value: [] };
  if (!Array.isArray(v))
    return { ok: false, expected: "a list of {key, label, detail, recommended}" };
  const options: QuestionOption[] = [];
  for (const item of v) {
    const o = (item ?? {}) as Record<string, unknown>;
    if (typeof o.key !== "string" && typeof o.key !== "number") {
      return { ok: false, expected: "a list of {key, label, detail, recommended}" };
    }
    options.push({
      key: String(o.key),
      label: typeof o.label === "string" ? o.label : String(o.key),
      detail: typeof o.detail === "string" ? o.detail : "",
      recommended: o.recommended === true,
    });
  }
  return { ok: true, value: options };
};

/** An answer without `by` was written before agents could answer, so it is yours. */
const answerReader: Reader<Question["answer"]> = (v) => {
  if (v === null || v === undefined) return { ok: true, value: null };
  const o = v as Record<string, unknown>;
  const by = o.by ?? "you";
  if (
    typeof v !== "object" ||
    typeof o.answered_at !== "string" ||
    (by !== "you" && by !== "agent")
  ) {
    return { ok: false, expected: "{option, text, answered_at, by: you | agent}" };
  }
  return {
    ok: true,
    value: {
      option: o.option === null || o.option === undefined ? null : String(o.option),
      text: typeof o.text === "string" ? o.text : "",
      answered_at: o.answered_at,
      by,
    },
  };
};

const resolutionReader: Reader<Question["resolution"]> = (v) => {
  if (v === null || v === undefined) return { ok: true, value: null };
  const o = v as Record<string, unknown>;
  if (
    typeof v !== "object" ||
    (o.kind !== "assumption" && o.kind !== "adr") ||
    typeof o.ref !== "string"
  ) {
    return { ok: false, expected: "{kind: assumption | adr, ref}" };
  }
  return { ok: true, value: { kind: o.kind, ref: o.ref } };
};

export function parseQuestion(text: string, file: string): Parsed<Question> {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { entity: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const { preamble, sections } = splitSections(fm.body);
  const entity: Question = {
    id: need(ctx, "id", r.id("question"), ""),
    title: need(ctx, "title", r.string(), ""),
    status: opt(ctx, "status", r.oneOf(QUESTION_STATUSES), "open"),
    feature: opt(ctx, "feature", r.nullable(r.id("feature")), null),
    blocking: opt(ctx, "blocking", r.bool(), false),
    raised_by: need(ctx, "raised_by", author, "you"),
    raised_at: need(ctx, "raised_at", r.datetime(), ""),
    links: opt(ctx, "links", anyIds(), []),
    context: sectionBody(sections, "Context") || preamble,
    options: opt(ctx, "options", optionsReader, []),
    answer: opt(ctx, "answer", answerReader, null),
    resolution: opt(ctx, "resolution", resolutionReader, null),
    review_ack_at: opt(ctx, "review_ack_at", r.nullable(r.datetime()), null),
    file,
  };
  unknownKeys(ctx, [
    "id",
    "title",
    "status",
    "feature",
    "blocking",
    "raised_by",
    "raised_at",
    "links",
    "options",
    "answer",
    "resolution",
    "review_ack_at",
  ]);
  return { entity: ctx.failed ? null : entity, problems: [...problems, ...finishSchema(ctx)] };
}

export function parseIssue(text: string, file: string): Parsed<Issue> {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { entity: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const id = need(ctx, "id", r.id("issue"), "");
  const type = need(ctx, "type", r.oneOf(ISSUE_TYPES), "bug");
  const isRisk = type === "risk";
  const entity: Issue = {
    id,
    type,
    title: need(ctx, "title", r.string(), ""),
    status: opt(ctx, "status", r.oneOf(ISSUE_STATUSES), "open"),
    severity: isRisk
      ? opt(ctx, "severity", r.nullable(r.oneOf(SEVERITIES)), null)
      : need(ctx, "severity", r.oneOf(SEVERITIES), "medium"),
    likelihood: isRisk
      ? need(ctx, "likelihood", r.oneOf(LEVELS), "medium")
      : opt(ctx, "likelihood", r.nullable(r.oneOf(LEVELS)), null),
    impact: isRisk
      ? need(ctx, "impact", r.oneOf(LEVELS), "medium")
      : opt(ctx, "impact", r.nullable(r.oneOf(LEVELS)), null),
    links: opt(ctx, "links", anyIds(), []),
    files: opt(ctx, "files", r.strings(), []),
    found_by: opt(ctx, "found_by", author, "you"),
    created: need(ctx, "created", r.date(), ""),
    resolved_at: opt(ctx, "resolved_at", r.nullable(r.date()), null),
    body: stripTitle(fm.body),
    file,
  };
  if (id && !id.startsWith(`${type.toUpperCase()}-`)) {
    ctx.failed = true;
    ctx.problems.push({
      code: "E-SCHEMA",
      severity: "error",
      file,
      line: fm.keyLines.type ?? null,
      ref: id,
      message: `type ${type} does not match the ID prefix of ${id}.`,
    });
  }
  unknownKeys(ctx, [
    "id",
    "type",
    "title",
    "status",
    "severity",
    "likelihood",
    "impact",
    "links",
    "files",
    "found_by",
    "created",
    "resolved_at",
  ]);
  return { entity: ctx.failed ? null : entity, problems: [...problems, ...finishSchema(ctx)] };
}

export function parseSession(text: string, file: string): Parsed<Session> {
  const { fm, problems, ok } = readFrontmatter(text, file);
  if (!ok) return { entity: null, problems };
  const ctx = fieldContext(file, fm.data, fm.keyLines);
  const { sections } = splitSections(fm.body);
  const entity: Session = {
    id: need(ctx, "id", r.id("session"), ""),
    agent: opt(ctx, "agent", r.string(), "claude-code"),
    skill: opt(ctx, "skill", r.nullable(r.string()), null),
    started_at: need(ctx, "started_at", r.datetime(), ""),
    ended_at: opt(ctx, "ended_at", r.nullable(r.datetime()), null),
    goal: opt(ctx, "goal", r.string(), ""),
    touched: opt(ctx, "touched", anyIds(), []),
    commits: opt(ctx, "commits", r.strings(), []),
    raised: opt(ctx, "raised", anyIds(), []),
    summary: sectionBody(sections, "Summary"),
    handoff: sectionBody(sections, "Handoff"),
    goals: sectionBody(sections, "Goals"),
    notes: sectionBody(sections, "Notes"),
    file,
  };
  unknownKeys(ctx, [
    "id",
    "agent",
    "skill",
    "started_at",
    "ended_at",
    "goal",
    "touched",
    "commits",
    "raised",
  ]);
  return { entity: ctx.failed ? null : entity, problems: [...problems, ...finishSchema(ctx)] };
}
