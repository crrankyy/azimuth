import {
  createDecision,
  createFeature,
  createIssue,
  createMilestone,
  createQuestion,
  scaffoldSpec,
  type Created,
} from "../../core/create";
import { featureOf } from "../../core/ids";
import { recordInSession } from "../../core/session";
import {
  acknowledge,
  addLogEntry,
  answerQuestion,
  move as moveEntity,
  proceedWithRecommendation,
  reapproveFeature,
  resolveQuestion,
  setField,
  type Result,
  type Who,
} from "../../core/transitions";
import { PRIORITIES, type Priority, type QuestionOption } from "../../core/types";
import { print, printJson, requirePositional, runtime, UsageError, type Runtime } from "../io";
import type { Command } from "../types";

function report(rt: Runtime, result: Result | Created, text: string): void {
  if (rt.json) printJson(result);
  else print(text);
}

/** Prints a new record's ID on stdout and its files on stderr, or `{id, files}` with --json. */
function reportCreated(rt: Runtime, created: Created): void {
  if (rt.json) {
    printJson(created);
    return;
  }
  print(created.id);
  const files = created.files.length ? `created ${created.files.join(", ")}` : "nothing new";
  process.stderr.write(`${files}\n`);
}

/**
 * Reports a new question like any record, then, under autonomy.questions: proceed, answers it with
 * the agent's recommendation and says so on stderr, so stdout stays the ID alone. With --json the
 * output gains `answered`, printed even when answering fails so the ID is never lost.
 */
function reportQuestion(rt: Runtime, created: Created, who: Who): void {
  if (!rt.json) reportCreated(rt, created);
  let answered: Result | null = null;
  try {
    answered = proceedWithRecommendation(rt.root, created.id, who);
  } finally {
    if (rt.json) printJson({ ...created, answered });
  }
  if (rt.json || !answered) return;
  process.stderr.write(
    `${answered.message}\nProceed with it and record it with azimuth resolve ${created.id}. The user can overrule it in the viewer.\n`,
  );
}

function list(value: unknown): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((v) => String(v).split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Where the label ends: the first ": " outside brackets and quotes, or -1. */
function labelEnd(text: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    else if (c === ":" && text[i + 1] === " " && depth === 0) return i;
  }
  return -1;
}

/**
 * `--option key="Label: detail"` (repeatable; commas are ordinary text, unlike `--links`);
 * `--recommend key` marks the recommendation.
 */
export function parseOptions(raw: unknown, recommend: unknown): QuestionOption[] {
  const specs = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return specs.map((value) => {
    const spec = String(value).trim();
    const eq = spec.indexOf("=");
    if (eq <= 0) throw new UsageError(`--option must look like key="Label: detail" (got ${spec}).`);
    const key = spec.slice(0, eq).trim();
    const text = spec.slice(eq + 1).trim();
    const colon = labelEnd(text);
    return {
      key,
      label: colon === -1 ? text : text.slice(0, colon),
      detail: colon === -1 ? "" : text.slice(colon + 2),
      recommended: key === recommend,
    };
  });
}

export const newCommand: Command = {
  usage:
    'new <feature|spec|milestone|adr|question|issue> "<title>" [--summary] [--priority P0-P3] [--milestone M-NN] [--feature F-NNN] [--blocking] [--option key="Label: detail"]… [--recommend key] [--type bug|debt|risk] [--severity] [--links IDs] [--files paths]',
  summary: "Create a feature, its spec files, a milestone, decision, question or issue",
  options: {
    summary: { type: "string" },
    context: { type: "string" },
    priority: { type: "string" },
    milestone: { type: "string" },
    feature: { type: "string" },
    blocking: { type: "boolean" },
    option: { type: "string", multiple: true },
    recommend: { type: "string" },
    type: { type: "string" },
    severity: { type: "string" },
    links: { type: "string" },
    files: { type: "string" },
    json: { type: "boolean" },
  },
  run({ values, positionals }) {
    const kind = requirePositional(positionals, 0, "kind");
    const rt = runtime(values);
    const ctx = { actor: rt.actor, session: rt.session };
    const title = kind === "spec" ? "" : requirePositional(positionals, 1, "title");
    let created: Created;
    let toRecord: Parameters<typeof recordInSession>[2] | null = null;
    switch (kind) {
      case "feature": {
        const priority = values.priority as string | undefined;
        if (priority && !(PRIORITIES as readonly string[]).includes(priority))
          throw new UsageError("--priority must be P0, P1, P2 or P3.");
        created = createFeature(
          rt.root,
          {
            title,
            summary: values.summary as string | undefined,
            priority: priority as Priority | undefined,
            milestone: (values.milestone as string | undefined) ?? null,
          },
          ctx,
        );
        toRecord = { touched: [created.id] };
        break;
      }
      case "spec": {
        const featureId = requirePositional(positionals, 1, "F-ID");
        created = scaffoldSpec(rt.root, featureId, ctx);
        toRecord = { touched: [featureId] };
        break;
      }
      case "milestone":
        created = createMilestone(
          rt.root,
          { title, goal: values.summary as string | undefined },
          ctx,
        );
        break;
      case "adr":
      case "decision":
        created = createDecision(rt.root, { title, links: list(values.links) }, ctx);
        toRecord = { raised: [created.id] };
        break;
      case "question": {
        const options = parseOptions(values.option, values.recommend);
        created = createQuestion(
          rt.root,
          {
            title,
            context: (values.context ?? values.summary) as string | undefined,
            feature: (values.feature as string | undefined) ?? null,
            blocking: Boolean(values.blocking),
            options,
            links: list(values.links),
          },
          ctx,
        );
        toRecord = { raised: [created.id] };
        break;
      }
      case "issue": {
        const type = (values.type as string | undefined) ?? "bug";
        if (type !== "bug" && type !== "debt" && type !== "risk")
          throw new UsageError("--type must be bug, debt or risk.");
        created = createIssue(
          rt.root,
          {
            type,
            title,
            severity: values.severity as string | undefined,
            files: list(values.files),
            links: list(values.links),
          },
          ctx,
        );
        toRecord = { raised: [created.id] };
        break;
      }
      default:
        throw new UsageError(
          `Unknown kind "${kind}". Use feature, spec, milestone, adr, question or issue.`,
        );
    }
    // The ID goes out before anything that can still fail, so `$(azimuth new …)` never loses one.
    if (kind === "question") reportQuestion(rt, created, ctx);
    else reportCreated(rt, created);
    if (toRecord) recordInSession(rt.root, rt.session, toRecord);
  },
};

function touch(rt: Runtime, ref: string): void {
  const feature = featureOf(ref);
  recordInSession(rt.root, rt.session, {
    touched: feature && feature !== ref ? [feature, ref] : [ref],
  });
}

export const move: Command = {
  usage: 'move <ID> <status> [--reason "…"] [--note "…"] [--by <ID>] [--override]',
  summary: "Change the status of a feature, task, decision, milestone, issue or question (gated)",
  options: {
    reason: { type: "string" },
    note: { type: "string" },
    by: { type: "string" },
    override: { type: "boolean" },
    json: { type: "boolean" },
  },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "ID");
    const to = requirePositional(positionals, 1, "status");
    const rt = runtime(values);
    const result = moveEntity(rt.root, id, to, {
      actor: rt.actor,
      session: rt.session,
      reason: values.reason as string | undefined,
      note: values.note as string | undefined,
      supersededBy: values.by as string | undefined,
      override: Boolean(values.override),
    });
    touch(rt, id);
    report(rt, result, result.message);
  },
};

export const reapprove: Command = {
  usage: "reapprove <F-ID>",
  summary: "Approve a changed spec again (re-runs the approval gate)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "F-ID");
    const rt = runtime(values);
    const result = reapproveFeature(rt.root, id, { actor: rt.actor, session: rt.session });
    touch(rt, id);
    report(rt, result, result.message);
  },
};

export const answer: Command = {
  usage: 'answer <Q-ID> [--option <key>] [--text "…"]',
  summary: "Answer a question, or replace an agent's answer (you only)",
  options: { option: { type: "string" }, text: { type: "string" }, json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "Q-ID");
    const rt = runtime(values);
    const result = answerQuestion(
      rt.root,
      id,
      {
        option: (values.option as string | undefined) ?? null,
        text: values.text as string | undefined,
      },
      { actor: rt.actor, session: rt.session },
    );
    report(rt, result, result.message);
  },
};

export const resolve: Command = {
  usage: "resolve <Q-ID> (--adr ADR-NNNN | --assumption F-NNN)",
  summary: "Record how an answered question was applied",
  options: { adr: { type: "string" }, assumption: { type: "string" }, json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "Q-ID");
    const rt = runtime(values);
    const adr = values.adr as string | undefined;
    const assumption = values.assumption as string | undefined;
    if (Boolean(adr) === Boolean(assumption))
      throw new UsageError("Pass exactly one of --adr or --assumption.");
    const result = resolveQuestion(
      rt.root,
      id,
      adr ? { kind: "adr", ref: adr } : { kind: "assumption", ref: assumption as string },
      { actor: rt.actor, session: rt.session },
    );
    touch(rt, id);
    report(rt, result, result.message);
  },
};

export const ack: Command = {
  usage: "ack <F-ID | ADR-ID | Q-ID>",
  summary: "Acknowledge an automatic approval, acceptance or answer (you only)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "ID");
    const rt = runtime(values);
    const result = acknowledge(rt.root, id, { actor: rt.actor, session: rt.session });
    report(rt, result, result.message);
  },
};

export const set: Command = {
  usage: "set <ID> <priority|size|milestone|severity> <value|none>",
  summary: "Set a plain field on a feature or issue",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "ID");
    const field = requirePositional(positionals, 1, "field");
    const raw = requirePositional(positionals, 2, "value");
    const rt = runtime(values);
    const result = setField(rt.root, id, field, raw === "none" ? null : raw, {
      actor: rt.actor,
      session: rt.session,
    });
    touch(rt, id);
    report(rt, result, result.message);
  },
};

export const log: Command = {
  usage: 'log <ID> "<message>" [--review]',
  summary: "Add a progress note (or, as you, a change request) to a feature's log",
  options: { review: { type: "boolean" }, json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "ID");
    const message = requirePositional(positionals, 1, "message");
    const rt = runtime(values);
    const result = addLogEntry(rt.root, id, values.review ? "review" : "note", message, {
      actor: rt.actor,
      session: rt.session,
    });
    touch(rt, id);
    report(rt, result, result.message);
  },
};
