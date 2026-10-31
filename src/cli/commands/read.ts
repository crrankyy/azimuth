import { writeFileSync, mkdirSync } from "node:fs";
import cliDoc from "../../../docs/cli.md?raw";
import conceptsDoc from "../../../docs/concepts.md?raw";
import formatsDoc from "../../../docs/file-format.md?raw";
import { buildIndex } from "../../core/build-index";
import { showBrief, statusBrief } from "../../core/brief";
import { featureOf, idKind } from "../../core/ids";
import {
  crossFeatureGroups,
  nextForFeature,
  nextWork,
  taskGroups,
  type CrossFeatureGroups,
  type TaskGroup,
} from "../../core/next";
import { azPath } from "../../core/paths";
import type { Index, Problem } from "../../core/types";
import { viewerUrl } from "../../server/registry";
import { color, print, printJson, requirePositional, runtime, UsageError } from "../io";
import type { Command } from "../types";
import { showRun } from "./runs";

function problemLine(p: Problem): string {
  const where = `${p.file}${p.line ? `:${p.line}` : ""}`;
  const tag = p.severity === "error" ? color.red(p.code) : color.yellow(p.code);
  return `${tag} ${where}${p.ref ? ` ${p.ref}` : ""}\n  ${p.message}`;
}

/** Problems about an ID: its own, its file's, or (for a feature) any of its parts'. */
function relatedTo(p: Problem, ids: string[]): boolean {
  return ids.some(
    (id) =>
      p.ref === id ||
      (p.ref !== null && featureOf(p.ref) === id) ||
      p.file.includes(`/${id}-`) ||
      p.file.includes(`/${id}.`),
  );
}

/** One line counting warnings by code, most frequent first (ties by code). */
function warningSummary(warnings: Problem[]): string {
  const counts = new Map<string, number>();
  for (const w of warnings) counts.set(w.code, (counts.get(w.code) ?? 0) + 1);
  const byCount = [...counts].sort(([a, m], [b, n]) => n - m || a.localeCompare(b));
  const parts = byCount.map(([code, n]) => `${n} ${code}`).join(", ");
  return `${warnings.length} warnings: ${parts} (--warnings lists them)`;
}

export const check: Command = {
  usage: "check [ID…] [--warnings] [--json]",
  summary: "Validate .azimuth/ and report problems (exit 1 on errors)",
  options: { json: { type: "boolean" }, warnings: { type: "boolean" } },
  run({ values, positionals }) {
    const rt = runtime(values);
    const { problems } = buildIndex(rt.root, { mode: "live" });
    const shown = positionals.length ? problems.filter((p) => relatedTo(p, positionals)) : problems;
    const errors = shown.filter((p) => p.severity === "error");
    const warnings = shown.filter((p) => p.severity === "warning");
    if (rt.json) printJson(shown);
    else if (shown.length === 0) print(color.green("No problems."));
    else {
      // Hundreds of warnings on every run bury the errors, so they are counted unless asked for.
      const listAll = Boolean(values.warnings) || positionals.length > 0;
      for (const p of listAll ? shown : errors) print(problemLine(p));
      if (!listAll && warnings.length > 0) print(warningSummary(warnings));
      print(`\n${errors.length} errors, ${warnings.length} warnings`);
    }
    return errors.length > 0 ? 1 : 0;
  },
};

export const index: Command = {
  usage: "index [--out <file>]",
  summary: "Write the index to .azimuth/cache/index.json (or --out)",
  options: { out: { type: "string" }, json: { type: "boolean" } },
  run({ values }) {
    const rt = runtime(values);
    const { index } = buildIndex(rt.root, { mode: "live" });
    const out = (values.out as string | undefined) ?? azPath(rt.root, "cache", "index.json");
    mkdirSync(azPath(rt.root, "cache"), { recursive: true });
    writeFileSync(out, JSON.stringify(index));
    if (rt.json) printJson({ file: out, rev: index.rev });
    else print(`Wrote ${out}`);
  },
};

export const status: Command = {
  usage: "status [--brief | --json]",
  summary: "Project summary: what needs you, work in flight, what's next",
  options: { brief: { type: "boolean" }, json: { type: "boolean" } },
  run({ values }) {
    let rt;
    try {
      rt = runtime(values);
    } catch (e) {
      // Skills inject `status --brief` into their prompt; outside a project that must not fail.
      if (values.brief && e instanceof UsageError) {
        print("No Azimuth project in this repository yet. Run /azimuth:init to set one up.");
        return 0;
      }
      throw e;
    }
    const { index } = buildIndex(rt.root, { mode: "live" });
    if (rt.json) printJson(index);
    else print(statusBrief(index, viewerUrl(rt.root)));
  },
};

export const show: Command = {
  usage: "show <ID> [--brief | --json]",
  summary: "One item with its derived state",
  options: { brief: { type: "boolean" }, json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requirePositional(positionals, 0, "ID");
    const rt = runtime(values);
    if (idKind(id) === "run") {
      showRun(rt.root, id, { brief: Boolean(values.brief), json: rt.json });
      return;
    }
    const { index } = buildIndex(rt.root, { mode: "live" });
    if (rt.json) {
      const entity = findEntity(index, id);
      if (!entity) throw new UsageError(`${id} not found.`);
      printJson(entity);
      return;
    }
    const brief = showBrief(index, id);
    if (!brief) throw new UsageError(`${id} not found.`);
    print(brief);
  },
};

function findEntity(index: Index, id: string): unknown {
  const pools: { id: string }[][] = [
    index.features,
    index.milestones,
    index.decisions,
    index.questions,
    index.issues,
    index.sessions,
  ];
  for (const pool of pools) {
    const hit = pool.find((x) => x.id === id);
    if (hit) return hit;
  }
  for (const f of index.features) {
    const task = f.detail?.tasks.find((t) => t.id === id);
    if (task) return task;
    for (const s of f.detail?.stories ?? []) {
      if (s.id === id) return s;
      const sc = s.scenarios.find((x) => x.id === id);
      if (sc) return sc;
    }
  }
  return null;
}

/** `Can run together: T-1, T-2 (shared: a.ts)`, or `On its own: T-3` for a group of one. */
function groupLine(g: TaskGroup): string {
  if (g.tasks.length < 2) return `On its own: ${g.tasks.join(", ")}`;
  const shared = g.shared.length > 0 ? ` (shared: ${g.shared.join(", ")})` : "";
  return `Can run together: ${g.tasks.join(", ")}${shared}`;
}

/** Group lines printed after `Across …:`; more groups are counted on one line. */
const MAX_CROSS_GROUP_LINES = 6;

/**
 * `Across <features joined by ", ">:`, then groupLine(g) for the first MAX_CROSS_GROUP_LINES
 * groups, then `… and <n> more` (status --brief's wording) when n further groups exist.
 */
function crossFeatureLines(cross: CrossFeatureGroups): string[] {
  const shown = cross.groups.slice(0, MAX_CROSS_GROUP_LINES).map(groupLine);
  const more = cross.groups.length - shown.length;
  return [
    `Across ${cross.features.join(", ")}:`,
    ...shown,
    ...(more > 0 ? [`… and ${more} more`] : []),
  ];
}

export const next: Command = {
  usage: "next [F-ID] [--json]",
  summary: "The highest-priority unblocked work (or the ready tasks of one feature)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const rt = runtime(values);
    const { index } = buildIndex(rt.root, { mode: "live" });
    const featureId = positionals[0];
    let items;
    let groups: TaskGroup[] | null = null;
    if (featureId) {
      const f = index.features.find((x) => x.id === featureId);
      if (!f) throw new UsageError(`${featureId} not found.`);
      items = nextForFeature(index, f);
      groups = taskGroups(index, f);
    } else {
      items = nextWork(index);
    }
    if (rt.json) printJson(groups ? { items, groups } : items);
    else if (items.length === 0) print("Nothing to do: no unblocked work.");
    else {
      for (const i of items) print(`${color.bold(i.ref)} ${i.action}\n  ${color.dim(i.reason)}`);
      // With a single ready task there is nothing to run beside it.
      if (groups && groups.flatMap((g) => g.tasks).length >= 2)
        for (const g of groups) print(groupLine(g));
      // Without an ID the orchestrator picks across features, so it needs to know which of
      // their ready tasks can run side by side; next F-NNN already shows its own groups.
      const cross = featureId ? null : crossFeatureGroups(index);
      if (cross) for (const line of crossFeatureLines(cross)) print(line);
    }
  },
};

export const trace: Command = {
  usage: "trace [F-ID] [--all] [--json]",
  summary:
    'Scenario → test coverage (tests named "S-…", @pytest.mark.scenario or // scenario: S-…)',
  options: { json: { type: "boolean" }, all: { type: "boolean" } },
  run({ values, positionals }) {
    const rt = runtime(values);
    const { index } = buildIndex(rt.root, { mode: "live" });
    const features = positionals[0]
      ? index.features.filter((f) => f.id === positionals[0])
      : index.features;
    const rows = features.flatMap((f) =>
      (f.detail?.stories ?? []).flatMap((s) =>
        s.scenarios.map((sc) => ({
          feature: f.id,
          scenario: sc.id,
          title: sc.title,
          ...sc.coverage,
        })),
      ),
    );
    if (rt.json) {
      printJson(rows);
      return;
    }
    const mark = {
      passing: color.green("passing"),
      failing: color.red("failing"),
      "not-run": color.dim("not-run"),
      untested: color.yellow("untested"),
    };
    // A comment citing a scenario ID reads like a miss next to real tests, so it is hidden.
    const showAll = Boolean(values.all);
    let hidden = 0;
    for (const r of rows) {
      print(`${r.scenario} ${mark[r.status]} ${r.title}`);
      for (const t of r.tests) {
        const mention = t.confidence === "fallback";
        if (mention && !showAll) {
          hidden++;
          continue;
        }
        const marks = `${mention ? " (mention)" : ""}${t.committed ? "" : " (uncommitted)"}`;
        print(color.dim(`    ${t.file}: ${t.name}${marks}`));
      }
    }
    if (hidden > 0) print(`${hidden} mention-only references hidden (--all shows them)`);
  },
};

const DOCS: Record<string, { text: string; summary: string }> = {
  formats: { text: formatsDoc, summary: "Every file in .azimuth/: its fields, values and rules" },
  concepts: { text: conceptsDoc, summary: "Lifecycles, gates, autonomy, traceability, problems" },
  cli: { text: cliDoc, summary: "Every command and option" },
};

/** The reference docs, bundled into the CLI so agents read them instead of Azimuth's code. */
export const docs: Command = {
  usage: `docs [${Object.keys(DOCS).join("|")}]`,
  summary: "Reference: file formats, concepts and commands (read these, not Azimuth's code)",
  run({ positionals }) {
    const topic = positionals[0];
    if (!topic) {
      const width = Math.max(...Object.keys(DOCS).map((k) => k.length));
      const lines = Object.entries(DOCS).map(
        ([name, d]) => `  azimuth docs ${name.padEnd(width)}  ${d.summary}`,
      );
      print(`Azimuth reference:\n${lines.join("\n")}`);
      return 0;
    }
    const doc = DOCS[topic];
    if (!doc) {
      throw new UsageError(`Unknown topic "${topic}". Topics: ${Object.keys(DOCS).join(", ")}.`);
    }
    print(doc.text.trimEnd());
    return 0;
  },
};
