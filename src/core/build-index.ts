import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { derive, milestoneProgress, type Derived } from "./derive";
import type { Facts } from "./facts";
import { nextGate, type GateContext } from "./gates";
import { gitFacts, toUtc } from "./git";
import { buildInbox } from "./inbox";
import { compareIds } from "./ids";
import { readLiveSessions } from "./live";
import { loadProject, type FeatureEntity, type Model } from "./model";
import { traceTests } from "./trace";
import type { Feature, FeatureDetail, Index, LiveSession, Problem, VerifyRun } from "./types";
import { sortProblems, validate } from "./validate";

export interface BuildOptions {
  mode?: "live" | "export";
  now?: Date;
  server?: Index["server"];
  live?: LiveSession[];
}

export interface BuildResult {
  index: Index;
  model: Model;
  facts: Facts;
  derived: Derived;
  problems: Problem[];
  ctx: GateContext;
}

/** Everything a command needs to reason about the project: model, facts and analysis. */
export function analyzeProject(root: string, now = new Date()): Omit<BuildResult, "index"> {
  const model = loadProject(root);
  const facts: Facts = {
    now,
    git: gitFacts(root, model),
    tests: traceTests(root, model.config.tests.globs),
    exists: (path) => existsSync(join(root, path)),
  };
  const derived = derive(model, facts);
  const problems = sortProblems([...model.problems, ...validate(model, facts, derived)]);
  const ctx: GateContext = { model, facts, derived, problems };
  return { model, facts, derived, problems, ctx };
}

function featureDetail(f: FeatureEntity, derived: Derived, facts: Facts): FeatureDetail {
  return {
    context: f.context,
    impact: f.impact.map((e) => ({ ...e, exists: facts.exists(e.path) })),
    stories: f.stories.map((s) => ({
      id: s.id,
      title: s.title,
      intent: s.intent,
      scenarios: s.scenarios.map((sc) => ({
        id: sc.id,
        title: sc.title,
        kind: sc.kind,
        given: sc.given,
        when: sc.when,
        then: sc.then,
        coverage: derived.coverage.get(sc.id) ?? { status: "untested", tests: [] },
      })),
    })),
    contract: f.contract,
    tasks: f.tasks.map((t) => {
      const run = derived.lastRun.get(t.id);
      return { ...t, last_run: run ? { run: run.id, ok: run.ok, at: run.at } : null };
    }),
    log: f.log.map(({ line: _line, ...entry }) => entry),
    as_built: f.asBuilt,
    notes: f.notes,
  };
}

function toFeature(f: FeatureEntity, ctx: GateContext): Feature {
  const info = ctx.derived.info.get(f.id);
  if (!info) throw new Error(`No derived data for ${f.id}`);
  return {
    id: f.id,
    slug: f.slug,
    title: f.title,
    summary: f.summary,
    status: f.status,
    priority: f.priority,
    size: f.size,
    mode: f.mode,
    milestone: f.milestone,
    depends_on: f.depends_on,
    superseded_by: f.superseded_by,
    tags: f.tags,
    created: f.created,
    updated: f.updated,
    approved_at: f.approved_at,
    approved_by: f.approved_by,
    approved_commit: f.approved_commit,
    review_ack_at: f.review_ack_at,
    file: f.dir,
    derived: { ...info, next_gate: nextGate(ctx, f) },
    detail: featureDetail(f, ctx.derived, ctx.facts),
  };
}

const RECENT_RUNS = 200;

/** Newest first: the 200 most recent runs plus the latest run of every task. */
function indexRuns(runs: VerifyRun[]): VerifyRun[] {
  const newest = [...runs].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || compareIds(b.id, a.id),
  );
  const latestPerTask = new Set<string>();
  const seenTargets = new Set<string>();
  for (const run of newest) {
    if (seenTargets.has(run.target)) continue;
    seenTargets.add(run.target);
    latestPerTask.add(run.id);
  }
  return newest.filter((run, i) => i < RECENT_RUNS || latestPerTask.has(run.id));
}

export function indexRev(index: Index): string {
  const stable = { ...index, generated_at: "", rev: "", server: null, live: [] };
  return createHash("sha1").update(JSON.stringify(stable)).digest("hex").slice(0, 12);
}

/** Builds the full index (spec §18 plus v0.1 additions) for the project at `root`. */
export function buildIndex(root: string, options: BuildOptions = {}): BuildResult {
  const now = options.now ?? new Date();
  const analysis = analyzeProject(root, now);
  const { model, facts, ctx, problems } = analysis;
  const { config, knowledge } = model;
  const arch = knowledge.architecture;
  const mode = options.mode ?? "live";

  const index: Index = {
    schema: 1,
    generated_at: toUtc(now.toISOString()),
    mode,
    rev: "",
    server: options.server ?? null,
    project: {
      name: config.project.name,
      description: config.project.description,
      mode: config.project.mode,
      stack: config.stack.display,
      commands: config.commands,
      git: { branch: facts.git.branch, head: facts.git.head, dirty: facts.git.dirty },
      autonomy: config.autonomy,
      editor_url: config.viewer.editor_url,
      root: mode === "live" ? root : null,
      shared_files: config.parallel.shared_files,
    },
    knowledge: {
      vision: knowledge.vision,
      architecture: {
        file: arch.file,
        updated: arch.updated,
        body: arch.body,
        reconciled_at: arch.reconciled_at,
        commits_since_reconciled: arch.reconciled_at
          ? (facts.git.commitsAfter(arch.reconciled_at) ?? 0)
          : 0,
        modules: arch.modules,
      },
      conventions: knowledge.conventions,
      glossary: knowledge.glossary,
      glossary_file: knowledge.glossaryFile,
    },
    milestones: model.milestones.map((m) => ({ ...m, ...milestoneProgress(model, m.id) })),
    features: model.features.map((f) => toFeature(f, ctx)),
    decisions: model.decisions,
    questions: model.questions,
    issues: model.issues,
    sessions: [...model.sessions].sort(
      (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at),
    ),
    commits: facts.git.commits,
    runs: indexRuns(model.runs),
    live: options.live ?? readLiveSessions(root, now),
    inbox: buildInbox(ctx, analysis.derived),
    problems,
  };
  index.rev = indexRev(index);
  return { index, ...analysis };
}
