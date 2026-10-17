import { writeFileSync, mkdirSync } from "node:fs";
import { buildIndex } from "../../core/build-index";
import { showBrief, statusBrief } from "../../core/brief";
import { featureOf } from "../../core/ids";
import { nextForFeature, nextWork } from "../../core/next";
import { azPath } from "../../core/paths";
import type { Index, Problem } from "../../core/types";
import { viewerUrl } from "../../server/registry";
import { color, print, printJson, requirePositional, runtime, UsageError } from "../io";
import type { Command } from "../types";

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

export const check: Command = {
  usage: "check [ID…] [--json]",
  summary: "Validate .azimuth/ and report problems (exit 1 on errors)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const rt = runtime(values);
    const { problems } = buildIndex(rt.root, { mode: "live" });
    const shown = positionals.length ? problems.filter((p) => relatedTo(p, positionals)) : problems;
    const errors = shown.filter((p) => p.severity === "error").length;
    if (rt.json) printJson(shown);
    else if (shown.length === 0) print(color.green("No problems."));
    else {
      for (const p of shown) print(problemLine(p));
      print(`\n${errors} errors, ${shown.length - errors} warnings`);
    }
    return errors > 0 ? 1 : 0;
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
    index.runs,
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

export const next: Command = {
  usage: "next [F-ID] [--json]",
  summary: "The highest-priority unblocked work (or the ready tasks of one feature)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const rt = runtime(values);
    const { index } = buildIndex(rt.root, { mode: "live" });
    const featureId = positionals[0];
    let items;
    if (featureId) {
      const f = index.features.find((x) => x.id === featureId);
      if (!f) throw new UsageError(`${featureId} not found.`);
      items = nextForFeature(index, f);
    } else {
      items = nextWork(index);
    }
    if (rt.json) printJson(items);
    else if (items.length === 0) print("Nothing to do: no unblocked work.");
    else for (const i of items) print(`${color.bold(i.ref)} ${i.action}\n  ${color.dim(i.reason)}`);
  },
};

export const trace: Command = {
  usage: "trace [F-ID] [--json]",
  summary: "Scenario → test coverage",
  options: { json: { type: "boolean" } },
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
    for (const r of rows) {
      print(`${r.scenario} ${mark[r.status]} ${r.title}`);
      for (const t of r.tests)
        print(
          color.dim(`    ${t.file}: ${t.name}${t.confidence === "fallback" ? " (mention)" : ""}`),
        );
    }
  },
};
