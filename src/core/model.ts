import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, type Config } from "./config";
import { splitFrontmatter } from "./frontmatter";
import { ID_PATTERNS, compareIds } from "./ids";
import { idFromName, idMismatch, problem } from "./parse/common";
import {
  parseAsBuilt,
  parseContract,
  parseFeatureMd,
  parseImpact,
  parsePlan,
  type FeatureHeader,
  type ImpactRaw,
  type TaskRaw,
} from "./parse/feature";
import {
  parseArchitecture,
  parseDoc,
  parseGlossary,
  type ArchitectureDoc,
} from "./parse/knowledge";
import { parseLog, type LogEntryRaw } from "./parse/log";
import {
  parseDecision,
  parseIssue,
  parseMilestone,
  parseQuestion,
  parseSession,
  type MilestoneRecord,
} from "./parse/records";
import { parseRun } from "./parse/run";
import { parseStories, type StoryRaw } from "./parse/stories";
import { AZ_DIR, azPath } from "./paths";
import type { SpecParts } from "./spec-hash";
import type {
  AsBuilt,
  Decision,
  FeatureDetail,
  GlossaryTerm,
  Issue,
  KnowledgeDoc,
  Problem,
  Question,
  Session,
  VerifyRun,
} from "./types";

export interface FeatureFiles {
  feature: string;
  impact: string | null;
  stories: string | null;
  contract: string | null;
  plan: string | null;
  log: string | null;
  asBuilt: string | null;
}

export interface FeatureEntity extends FeatureHeader {
  slug: string;
  /** Repo-relative folder with a trailing slash. */
  dir: string;
  files: FeatureFiles;
  impact: ImpactRaw[];
  stories: StoryRaw[];
  contract: FeatureDetail["contract"];
  tasks: TaskRaw[];
  log: LogEntryRaw[];
  asBuilt: AsBuilt | null;
  /** Spec content for hashing; null until impact, stories and contract all exist. */
  spec: SpecParts | null;
}

export interface Model {
  root: string;
  config: Config;
  knowledge: {
    vision: KnowledgeDoc;
    architecture: ArchitectureDoc;
    conventions: KnowledgeDoc;
    glossary: GlossaryTerm[];
    glossaryFile: string;
  };
  milestones: MilestoneRecord[];
  features: FeatureEntity[];
  decisions: Decision[];
  questions: Question[];
  issues: Issue[];
  sessions: Session[];
  runs: VerifyRun[];
  problems: Problem[];
}

interface Memo {
  mtimeMs: number;
  size: number;
  value: unknown;
}

/** Parse results keyed by parser and path, reused while the file's mtime and size are unchanged. */
const memo = new Map<string, Memo>();

function cached<T>(kind: string, abs: string, parse: (text: string) => T): T | null {
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return null;
  }
  const key = `${kind}\0${abs}`;
  const hit = memo.get(key);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.value as T;
  const value = parse(readFileSync(abs, "utf8"));
  memo.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, value });
  return value;
}

export function clearParseCache(): void {
  memo.clear();
}

function readOptional(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function listDir(abs: string): string[] {
  try {
    return readdirSync(abs).sort(compareIds);
  } catch {
    return [];
  }
}

const rel = (...parts: string[]) => [AZ_DIR, ...parts].join("/");

/** Reads `.azimuth/` into a typed model. Never throws for bad content; problems describe it. */
export function loadProject(root: string): Model {
  const problems: Problem[] = [];
  const { config, problems: configProblems } = loadConfig(root);
  problems.push(...configProblems);

  const doc = (name: string) => {
    const file = rel("project", `${name}.md`);
    const result =
      cached(`doc`, azPath(root, "project", `${name}.md`), (t) => parseDoc(t, file)) ??
      parseDoc(null, file);
    problems.push(...result.problems);
    return result.doc;
  };
  const archFile = rel("project", "architecture.md");
  const architecture =
    cached("arch", azPath(root, "project", "architecture.md"), (t) =>
      parseArchitecture(t, archFile),
    ) ?? parseArchitecture(null, archFile);
  problems.push(...architecture.problems);
  const glossaryFile = rel("project", "glossary.md");
  const glossary =
    cached("glossary", azPath(root, "project", "glossary.md"), (t) =>
      parseGlossary(t, glossaryFile),
    ) ?? parseGlossary(null, glossaryFile);
  problems.push(...glossary.problems);

  const model: Model = {
    root,
    config,
    knowledge: {
      vision: doc("vision"),
      architecture: architecture.doc,
      conventions: doc("conventions"),
      glossary: glossary.terms,
      glossaryFile,
    },
    milestones: readRecords(root, "milestones", ID_PATTERNS.milestone, parseMilestone, problems),
    features: readFeatures(root, problems),
    decisions: readRecords(root, "decisions", ID_PATTERNS.decision, parseDecision, problems),
    questions: readRecords(root, "questions", ID_PATTERNS.question, parseQuestion, problems),
    issues: readRecords(root, "issues", ID_PATTERNS.issue, parseIssue, problems),
    sessions: readRecords(root, "sessions", ID_PATTERNS.session, parseSession, problems),
    runs: readRuns(root, problems),
    problems,
  };
  return model;
}

/** Reads one folder of single-file records, dropping duplicates and reporting ID mismatches. */
function readRecords<T extends { id: string }>(
  root: string,
  folder: string,
  pattern: RegExp,
  parse: (text: string, file: string) => { entity: T | null; problems: Problem[] },
  problems: Problem[],
): T[] {
  const namePattern = new RegExp(pattern.source.replace(/\$$/, ""));
  const out: T[] = [];
  const seen = new Map<string, string>();
  for (const name of listDir(azPath(root, folder))) {
    if (!name.endsWith(".md")) continue;
    const file = rel(folder, name);
    const fromName = idFromName(name.replace(/\.md$/, ""), namePattern);
    if (!fromName) {
      problems.push(
        problem("W-STRAY-FILE", file, null, `${name} is not named after an ID, so it is ignored.`),
      );
      continue;
    }
    const result = cached(folder, azPath(root, folder, name), (t) => parse(t, file));
    if (!result) continue;
    problems.push(...result.problems);
    if (!result.entity) continue;
    problems.push(...idMismatch(file, result.entity.id, fromName));
    const previous = seen.get(result.entity.id);
    if (previous) {
      problems.push(
        problem(
          "E-ID-DUP",
          file,
          2,
          `${result.entity.id} is also defined in ${previous}.`,
          result.entity.id,
        ),
      );
      continue;
    }
    seen.set(result.entity.id, file);
    out.push(result.entity);
  }
  return out;
}

const FEATURE_DIR = /^(F-\d{3})-(.+)$/;

function readFeatures(root: string, problems: Problem[]): FeatureEntity[] {
  const out: FeatureEntity[] = [];
  const seen = new Map<string, string>();
  for (const name of listDir(azPath(root, "features"))) {
    const abs = azPath(root, "features", name);
    const match = FEATURE_DIR.exec(name);
    if (!match || !statSync(abs).isDirectory()) continue;
    const dir = rel("features", name) + "/";
    const featureFile = `${dir}feature.md`;
    if (!existsSync(join(abs, "feature.md"))) {
      problems.push(
        problem("E-PARSE", featureFile, null, `${name} has no feature.md.`, match[1] ?? null),
      );
      continue;
    }
    const parsed = cached("feature", join(abs, "feature.md"), (t) =>
      parseFeatureMd(t, featureFile),
    );
    if (!parsed) continue;
    problems.push(...parsed.problems);
    if (!parsed.header) continue;
    const header = parsed.header;
    problems.push(...idMismatch(featureFile, header.id, match[1] ?? null));
    const previous = seen.get(header.id);
    if (previous) {
      problems.push(
        problem(
          "E-ID-DUP",
          featureFile,
          2,
          `${header.id} is also defined in ${previous}.`,
          header.id,
        ),
      );
      continue;
    }
    seen.set(header.id, featureFile);
    out.push(readFeatureFiles(root, abs, dir, match[2] ?? "", header, problems));
  }
  return out;
}

function readFeatureFiles(
  root: string,
  abs: string,
  dir: string,
  slug: string,
  header: FeatureHeader,
  problems: Problem[],
): FeatureEntity {
  const path = (name: string) => (existsSync(join(abs, name)) ? `${dir}${name}` : null);
  const files: FeatureFiles = {
    feature: `${dir}feature.md`,
    impact: path("impact.md"),
    stories: path("stories.md"),
    contract: path("contract.md"),
    plan: path("plan.md"),
    log: path("log.md"),
    asBuilt: path("as-built.md"),
  };
  const id = header.id;
  const read = <T>(
    file: string | null,
    kind: string,
    parse: (text: string, file: string) => T,
  ): T | null => (file ? cached(kind, join(root, file), (t) => parse(t, file)) : null);

  const impact = read(files.impact, "impact", (t, f) => parseImpact(t, f, id));
  const stories = read(files.stories, `stories:${id}`, (t, f) => parseStories(t, f, id));
  const contract = read(files.contract, "contract", parseContract);
  const plan = read(files.plan, `plan:${id}`, (t, f) => parsePlan(t, f, id));
  const log = read(files.log, "log", parseLog);
  const asBuilt = read(files.asBuilt, "as-built", (t, f) => parseAsBuilt(t, f, id));
  for (const result of [impact, stories, contract, plan, log, asBuilt]) {
    if (result) problems.push(...result.problems);
  }

  const raw = (file: string | null) => (file ? (readOptional(join(root, file)) ?? "") : null);
  const impactText = raw(files.impact);
  const storiesText = raw(files.stories);
  const contractText = raw(files.contract);
  const spec =
    impactText !== null && storiesText !== null && contractText !== null
      ? {
          featureBody: header.body,
          impact: impactText,
          stories: storiesText,
          contract: contractText,
        }
      : null;

  return {
    ...header,
    slug,
    dir,
    files,
    impact: impact?.files ?? [],
    stories: stories?.stories ?? [],
    contract: contract?.contract ?? { language: "", sections: [] },
    tasks: plan?.tasks ?? [],
    log: log?.entries ?? [],
    asBuilt: asBuilt?.asBuilt ?? null,
    spec,
  };
}

function readRuns(root: string, problems: Problem[]): VerifyRun[] {
  const runs: VerifyRun[] = [];
  for (const name of listDir(azPath(root, "cache", "runs"))) {
    if (!name.endsWith(".json")) continue;
    const file = rel("cache", "runs", name);
    const result = cached("run", azPath(root, "cache", "runs", name), (t) => parseRun(t, file));
    if (!result) continue;
    problems.push(...result.problems);
    if (result.run) runs.push(result.run);
  }
  return runs.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : compareIds(a.id, b.id)));
}

/** The body of feature.md as stored at a given text (used when hashing historical versions). */
export function featureBodyOf(text: string): string {
  return splitFrontmatter(text).body;
}
