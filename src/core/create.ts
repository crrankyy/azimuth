import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allocateId, type CounterKind } from "./allocate";
import { AzimuthError } from "./errors";
import { updateFrontmatter } from "./frontmatter";
import { toUtc } from "./git";
import { slugify } from "./ids";
import { withLock } from "./lock";
import { loadProject } from "./model";
import { azPath } from "./paths";
import { fill, TEMPLATES } from "./templates";
import type { Actor, Priority, QuestionOption } from "./types";

export interface CreateContext {
  actor: Actor;
  session: string | null;
  now?: Date;
}

export interface Created {
  id: string;
  files: string[];
}

/** The project's copy of a template when present, otherwise the built-in one. */
export function template(root: string, name: string): string {
  const custom = azPath(root, "templates", name);
  if (existsSync(custom)) return readFileSync(custom, "utf8");
  const builtin = TEMPLATES[name];
  if (!builtin) throw new Error(`Unknown template ${name}`);
  return builtin;
}

function baseValues(ctx: CreateContext): Record<string, string> {
  const now = ctx.now ?? new Date();
  return {
    date: now.toISOString().slice(0, 10),
    now: toUtc(now.toISOString()),
    actor: ctx.actor,
    session: ctx.session ? ` · ${ctx.session}` : "",
    // An agent working outside an Azimuth session is still an agent, not the user.
    raised_by: ctx.session ?? ctx.actor,
  };
}

function writeExclusive(root: string, rel: string, text: string): void {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text, { flag: "wx" });
}

export function createFeature(
  root: string,
  input: { title: string; summary?: string; priority?: Priority; milestone?: string | null },
  ctx: CreateContext,
): Created {
  const model = loadProject(root);
  if (input.milestone && !model.milestones.some((m) => m.id === input.milestone)) {
    throw new AzimuthError("not-found", `${input.milestone} does not exist.`);
  }
  const slug = slugify(input.title);
  let dir = "";
  const id = allocateId(root, "feature", (id) => {
    dir = `.azimuth/features/${id}-${slug}/`;
    mkdirSync(azPath(root, "features"), { recursive: true });
    mkdirSync(join(root, dir));
  });
  const values = {
    ...baseValues(ctx),
    id,
    title: input.title,
    summary: input.summary ?? "",
    priority: input.priority ?? "P2",
    mode: model.config.project.mode,
    milestone: input.milestone ?? "null",
  };
  writeExclusive(root, `${dir}feature.md`, fill(template(root, "feature/feature.md"), values));
  writeExclusive(root, `${dir}log.md`, fill(template(root, "feature/log.md"), values));
  return { id, files: [`${dir}feature.md`, `${dir}log.md`] };
}

/** Writes the spec files a feature is missing (impact, stories, contract, plan) from templates. */
export function scaffoldSpec(root: string, featureId: string, ctx: CreateContext): Created {
  return withLock(root, () => {
    const model = loadProject(root);
    const f = model.features.find((x) => x.id === featureId);
    if (!f) throw new AzimuthError("not-found", `${featureId} does not exist.`);
    const values = {
      ...baseValues(ctx),
      id: f.id,
      num: f.id.slice(2),
      title: f.title,
      language: model.config.stack.languages[0] ?? "",
    };
    const files: string[] = [];
    for (const name of ["impact", "stories", "contract", "plan"]) {
      const rel = `${f.dir}${name}.md`;
      if (existsSync(join(root, rel))) continue;
      writeExclusive(root, rel, fill(template(root, `feature/${name}.md`), values));
      files.push(rel);
    }
    return { id: f.id, files };
  });
}

function createRecord(
  root: string,
  kind: CounterKind,
  folder: string,
  name: (id: string) => string,
  templateName: string,
  values: Record<string, string>,
  updates: Record<string, unknown> = {},
): Created {
  let file = "";
  const id = allocateId(root, kind, (id) => {
    file = `.azimuth/${folder}/${name(id)}`;
    const text = fill(template(root, templateName), { ...values, id });
    // Fields go in before the file exists: a failure then leaves no half-made record and, since
    // allocateId only marks an ID once this succeeds, uses no ID.
    const filled = Object.keys(updates).length ? updateFrontmatter(text, updates) : text;
    writeExclusive(root, file, filled);
  });
  return { id, files: [file] };
}

export function createMilestone(
  root: string,
  input: { title: string; goal?: string },
  ctx: CreateContext,
): Created {
  return createRecord(
    root,
    "milestone",
    "milestones",
    (id) => `${id}-${slugify(input.title)}.md`,
    "milestone.md",
    {
      ...baseValues(ctx),
      title: input.title,
      summary: input.goal ?? "",
    },
  );
}

export function createDecision(
  root: string,
  input: { title: string; links?: string[] },
  ctx: CreateContext,
): Created {
  return createRecord(
    root,
    "decision",
    "decisions",
    (id) => `${id}-${slugify(input.title)}.md`,
    "decision.md",
    {
      ...baseValues(ctx),
      title: input.title,
    },
    input.links?.length ? { links: input.links } : {},
  );
}

export function createQuestion(
  root: string,
  input: {
    title: string;
    context?: string;
    feature?: string | null;
    blocking?: boolean;
    options?: QuestionOption[];
    links?: string[];
  },
  ctx: CreateContext,
): Created {
  if (input.feature && !loadProject(root).features.some((f) => f.id === input.feature)) {
    throw new AzimuthError("not-found", `${input.feature} does not exist.`);
  }
  const updates: Record<string, unknown> = {};
  if (input.options?.length) updates.options = input.options;
  if (input.links?.length) updates.links = input.links;
  return createRecord(
    root,
    "question",
    "questions",
    (id) => `${id}.md`,
    "question.md",
    {
      ...baseValues(ctx),
      title: input.title,
      summary: input.context ?? "",
      feature: input.feature ?? "null",
      blocking: input.blocking ? "true" : "false",
    },
    updates,
  );
}

export function createIssue(
  root: string,
  input: {
    type: "bug" | "debt" | "risk";
    title: string;
    severity?: string;
    files?: string[];
    links?: string[];
  },
  ctx: CreateContext,
): Created {
  const updates: Record<string, unknown> = {};
  if (input.severity && input.type !== "risk") updates.severity = input.severity;
  if (input.files?.length) updates.files = input.files;
  if (input.links?.length) updates.links = input.links;
  return createRecord(
    root,
    input.type,
    "issues",
    (id) => `${id}-${slugify(input.title)}.md`,
    `issue-${input.type}.md`,
    {
      ...baseValues(ctx),
      title: input.title,
    },
    updates,
  );
}
