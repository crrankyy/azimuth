import { codeCommitsAfter, milestoneProgress, milestoneReady, type Derived } from "./derive";
import { ACTIVE_STATUSES } from "./flows";
import type { Facts } from "./facts";
import { globToRegExp, inModule, matchesAny } from "./glob";
import { idKind } from "./ids";
import { printedName } from "./junit";
import type { FeatureEntity, Model } from "./model";
import { problem } from "./parse/common";
import { measuredValue } from "./parse/stories";
import { sessionStale } from "./session";
import type { FeatureStatus, Problem } from "./types";

const SPECIFIED: FeatureStatus[] = ["draft", ...ACTIVE_STATUSES];

/** Cross-entity rules (links, cycles, drift, coverage, paths, staleness). Parse rules live in parse/. */
export function validate(model: Model, facts: Facts, derived: Derived): Problem[] {
  return [
    ...linkProblems(model, derived),
    ...model.features.flatMap((f) => featureProblems(model, facts, derived, f)),
    ...conflictProblems(model),
    ...decisionProblems(model),
    ...questionProblems(model),
    ...milestoneProblems(model),
    ...sessionProblems(model, facts),
    ...architectureProblems(model, facts),
    ...testNameProblems(facts),
  ];
}

function knownIds(model: Model): Set<string> {
  const ids = new Set<string>();
  const add = (id: string) => ids.add(id);
  model.milestones.forEach((m) => add(m.id));
  model.decisions.forEach((d) => add(d.id));
  model.questions.forEach((q) => add(q.id));
  model.issues.forEach((i) => add(i.id));
  model.sessions.forEach((s) => add(s.id));
  model.runs.forEach((r) => add(r.id));
  for (const f of model.features) {
    add(f.id);
    f.stories.forEach((s) => {
      add(s.id);
      s.scenarios.forEach((x) => add(x.id));
    });
    f.tasks.forEach((t) => add(t.id));
  }
  return ids;
}

function linkProblems(model: Model, derived: Derived): Problem[] {
  const ids = knownIds(model);
  const out: Problem[] = [];
  const need = (
    file: string,
    ref: string,
    target: string | null,
    field: string,
    severity: "E" | "W" = "E",
  ) => {
    if (!target || target === "you" || ids.has(target)) return;
    // Mentions of entities that may be referenced before they exist (commits, tests) are not links.
    if (!idKind(target)) return;
    out.push(
      problem(
        `${severity}-LINK`,
        file,
        null,
        `${field} refers to ${target}, which does not exist.`,
        ref,
      ),
    );
  };
  for (const f of model.features) {
    const file = f.files.feature;
    need(file, f.id, f.milestone, "milestone");
    need(file, f.id, f.superseded_by, "superseded_by");
    f.depends_on.forEach((d) => need(file, f.id, d, "depends_on"));
    if (f.status === "superseded" && !f.superseded_by) {
      out.push(
        problem(
          "E-SCHEMA",
          file,
          f.keyLines.status ?? null,
          "A superseded feature needs superseded_by.",
          f.id,
        ),
      );
    }
    for (const t of f.tasks) {
      const plan = f.files.plan ?? file;
      for (const a of t.after) {
        if (!f.tasks.some((x) => x.id === a))
          out.push(
            problem(
              "E-TASK-REF",
              plan,
              null,
              `${t.id} waits for ${a}, which is not a task of ${f.id}.`,
              t.id,
            ),
          );
      }
      for (const s of t.covers) {
        if (!derived.coverage.has(s))
          out.push(
            problem(
              "E-TASK-REF",
              plan,
              null,
              `${t.id} covers ${s}, which is not a scenario of ${f.id}.`,
              t.id,
            ),
          );
      }
    }
    f.asBuilt?.follow_ups.forEach((id) =>
      need(f.files.asBuilt ?? file, f.id, id, "follow_ups", "W"),
    );
  }
  for (const d of model.decisions) {
    need(d.file, d.id, d.supersedes, "supersedes");
    need(d.file, d.id, d.superseded_by, "superseded_by");
    d.resolves.forEach((q) => need(d.file, d.id, q, "resolves", "W"));
    d.links.forEach((l) => need(d.file, d.id, l, "links", "W"));
  }
  for (const q of model.questions) {
    need(q.file, q.id, q.feature, "feature");
    need(q.file, q.id, q.raised_by, "raised_by", "W");
    q.links.forEach((l) => need(q.file, q.id, l, "links", "W"));
    if (q.resolution) need(q.file, q.id, q.resolution.ref, "resolution", "W");
  }
  for (const i of model.issues) {
    i.links.forEach((l) => need(i.file, i.id, l, "links", "W"));
    need(i.file, i.id, i.found_by, "found_by", "W");
  }
  for (const s of model.sessions) {
    [...s.touched, ...s.raised].forEach((l) => need(s.file, s.id, l, "touched/raised", "W"));
  }
  return out;
}

function hasCycle(edges: Map<string, string[]>): string[] {
  const state = new Map<string, "visiting" | "done">();
  const cyclic: string[] = [];
  const visit = (id: string): boolean => {
    if (state.get(id) === "visiting") return true;
    if (state.get(id) === "done") return false;
    state.set(id, "visiting");
    const found = (edges.get(id) ?? []).some(visit);
    state.set(id, "done");
    if (found) cyclic.push(id);
    return found;
  };
  for (const id of edges.keys()) visit(id);
  return cyclic;
}

function featureProblems(
  model: Model,
  facts: Facts,
  derived: Derived,
  f: FeatureEntity,
): Problem[] {
  const out: Problem[] = [];
  const specified = SPECIFIED.includes(f.status);
  const transitions = f.log.filter((e) => e.transition);
  const last = transitions.at(-1)?.transition?.to ?? "idea";
  if (last !== f.status) {
    out.push(
      problem(
        "E-STATUS-DRIFT",
        f.files.feature,
        f.keyLines.status ?? null,
        `status is ${f.status} but the log's last transition is to ${last}. Change status only with \`azimuth move\`.`,
        f.id,
      ),
    );
  }
  // An idea gets the story rule too, so `check` before the draft move catches what the approval
  // gate would refuse.
  if (specified || f.status === "idea") {
    for (const story of f.stories) {
      const kinds = new Set(story.scenarios.map((s) => s.kind));
      if (!kinds.has("happy") || !(kinds.has("negative") || kinds.has("edge"))) {
        out.push(
          problem(
            "W-NO-NEGATIVE",
            f.files.stories ?? f.files.feature,
            story.line,
            `${story.id} needs at least one happy and one negative or edge scenario.`,
            story.id,
          ),
        );
      }
    }
  }
  if (specified) {
    const covered = new Set(f.tasks.flatMap((t) => t.covers));
    for (const sc of f.stories.flatMap((s) => s.scenarios)) {
      if (covered.has(sc.id)) continue;
      const severity = f.status === "draft" ? "warning" : "error";
      out.push(
        problem(
          severity === "error" ? "E-UNCOVERED-SCENARIO" : "W-UNCOVERED-SCENARIO",
          f.files.plan ?? f.files.feature,
          null,
          `${sc.id} is not covered by any task.`,
          sc.id,
          severity,
        ),
      );
    }
    if (f.size === "XL") {
      out.push(
        problem(
          "W-SIZE-XL",
          f.files.feature,
          f.keyLines.size ?? null,
          `${f.id} is XL; split it before approval.`,
          f.id,
        ),
      );
    }
    const missing = (["impact", "stories", "contract", "plan"] as const).filter((k) => !f.files[k]);
    if (missing.length > 0) {
      out.push(
        problem(
          "E-SPEC-MISSING",
          f.files.feature,
          null,
          `${f.id} is ${f.status} but has no ${missing.map((m) => `${m}.md`).join(", ")}.`,
          f.id,
        ),
      );
    }
  }
  if (f.status === "draft") out.push(...measuredHints(f), ...noCoversHints(f));
  const taskEdges = new Map(f.tasks.map((t) => [t.id, t.after]));
  const cyclic = hasCycle(taskEdges);
  if (cyclic.length > 0) {
    out.push(
      problem(
        "E-TASK-CYCLE",
        f.files.plan ?? f.files.feature,
        null,
        `Tasks wait for each other in a cycle: ${cyclic.join(", ")}.`,
        f.id,
      ),
    );
  }
  if (specified) out.push(...pathProblems(model, facts, f));
  const info = derived.info.get(f.id);
  if (info?.stale) {
    out.push(
      problem(
        "W-STALE",
        f.files.feature,
        null,
        `${f.id} is in progress with no activity for over ${model.config.stale_after_days} days.`,
        f.id,
      ),
    );
  }
  return out;
}

/**
 * A value only the code can measure is a guess while drafting, which the build corrects with a
 * reapprove; left open, the first passing test settles it.
 */
function measuredHints(f: FeatureEntity): Problem[] {
  const file = f.files.stories ?? f.files.feature;
  return f.stories.flatMap((story) =>
    story.scenarios.flatMap((sc) =>
      sc.thenLines.flatMap((l) => {
        const value = measuredValue(l.text);
        if (value === null) return [];
        return [
          problem(
            "W-MEASURED",
            file,
            l.line,
            `"${value}" looks like a value only the code can measure. If it is, write {?} instead: the first passing test settles it.`,
            sc.id,
          ),
        ];
      }),
    ),
  );
}

/**
 * A task covering nothing reaches its lane without a THEN to hold it to. A task whose files are
 * all Markdown only documents, so it needs none.
 */
function noCoversHints(f: FeatureEntity): Problem[] {
  const onlyMarkdown = (files: string[]) =>
    files.length > 0 && files.every((path) => path.endsWith(".md"));
  return f.tasks
    .filter((t) => t.covers.length === 0 && !onlyMarkdown(t.files))
    .map((t) =>
      problem(
        "W-NO-COVERS",
        f.files.plan ?? f.files.feature,
        null,
        `${t.id} covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents.`,
        t.id,
      ),
    );
}

function pathProblems(model: Model, facts: Facts, f: FeatureEntity): Problem[] {
  const out: Problem[] = [];
  const file = f.files.impact ?? f.files.feature;
  const modules = model.knowledge.architecture.modules.map((m) => m.path);
  const outside = new Set<string>();
  for (const entry of f.impact) {
    // Files at the repository root (package.json, tsconfig.json…) configure the whole project.
    if (entry.change === "test" || !entry.path.includes("/")) continue;
    if (modules.length > 0 && !inModule(entry.path, modules)) {
      const dir = entry.path.includes("/")
        ? entry.path.slice(0, entry.path.lastIndexOf("/") + 1)
        : entry.path;
      outside.add(dir);
    }
    if ((entry.change === "modify" || entry.change === "read") && !facts.exists(entry.path)) {
      out.push(
        problem(
          "W-IMPACT-MISSING",
          file,
          null,
          `${entry.path} is listed as ${entry.change} but does not exist.`,
          f.id,
        ),
      );
    }
  }
  for (const dir of outside) {
    out.push(
      problem(
        "W-PATH",
        file,
        null,
        `${dir} is not under any module path in architecture.md.`,
        f.id,
      ),
    );
  }
  return out;
}

function conflictProblems(model: Model): Problem[] {
  const out: Problem[] = [];
  const active = model.features.filter((f) => ACTIVE_STATUSES.includes(f.status));
  const shared = model.config.parallel.shared_files.map(globToRegExp);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i] as FeatureEntity;
      const b = active[j] as FeatureEntity;
      const paths = (f: FeatureEntity) =>
        new Set(
          f.impact
            .filter((e) => e.change === "create" || e.change === "modify")
            .map((e) => e.path)
            .filter((path) => !matchesAny(path, shared)),
        );
      const bp = paths(b);
      for (const path of paths(a)) {
        if (!bp.has(path)) continue;
        out.push(
          problem(
            "W-FILE-CONFLICT",
            a.files.impact ?? a.files.feature,
            null,
            `${a.id} and ${b.id} both modify ${path}.`,
            a.id,
          ),
        );
      }
    }
  }
  return out;
}

function decisionProblems(model: Model): Problem[] {
  const out: Problem[] = [];
  const byId = new Map(model.decisions.map((d) => [d.id, d]));
  for (const d of model.decisions) {
    if (d.status === "superseded" && !d.superseded_by) {
      out.push(
        problem("E-SCHEMA", d.file, null, "A superseded decision needs superseded_by.", d.id),
      );
    }
    if (d.supersedes) {
      const old = byId.get(d.supersedes);
      if (old && old.superseded_by !== d.id) {
        out.push(
          problem(
            "W-SUPERSESSION",
            d.file,
            null,
            `${d.id} supersedes ${old.id}, but ${old.id} does not name ${d.id} as superseded_by.`,
            d.id,
          ),
        );
      }
    }
  }
  return out;
}

function questionProblems(model: Model): Problem[] {
  const out: Problem[] = [];
  for (const q of model.questions) {
    if (q.blocking && !q.feature) {
      out.push(
        problem(
          "W-QUESTION-FEATURE",
          q.file,
          null,
          `${q.id} is blocking but names no feature to block.`,
          q.id,
        ),
      );
    }
    if (q.options.length > 0 && q.options.filter((o) => o.recommended).length !== 1) {
      out.push(
        problem(
          "W-QUESTION-OPTIONS",
          q.file,
          null,
          `${q.id} should recommend exactly one option.`,
          q.id,
        ),
      );
    }
    if (q.status === "answered" && !q.answer) {
      out.push(problem("E-SCHEMA", q.file, null, `${q.id} is answered but has no answer.`, q.id));
    }
  }
  return out;
}

/** Only the user releases a milestone, so a finished one is reported until they do. */
function milestoneProblems(model: Model): Problem[] {
  return model.milestones
    .map((m) => ({ ...m, ...milestoneProgress(model, m.id) }))
    .filter(milestoneReady)
    .map((m) =>
      problem(
        "W-MILESTONE-READY",
        m.file,
        null,
        `Every feature of ${m.id} is done but it is still ${m.status}; ask the user to release it.`,
        m.id,
      ),
    );
}

function sessionProblems(model: Model, facts: Facts): Problem[] {
  return model.sessions
    .filter((s) => sessionStale(s, facts.now, facts.sesLastSeen.get(s.id)))
    .map((s) =>
      problem(
        "W-SESSION-OPEN",
        s.file,
        null,
        `${s.id} was never closed. Run \`azimuth session close --stale\`.`,
        s.id,
      ),
    );
}

/**
 * Verify matches marked tests by function name without the module path, so two such tests in
 * different files with the same name would share their results.
 */
function testNameProblems(facts: Facts): Problem[] {
  const byName = new Map<string, { files: Set<string>; scenario: string }>();
  for (const [scenario, refs] of [...facts.tests].sort(([a], [b]) => a.localeCompare(b))) {
    for (const ref of refs) {
      const name = printedName(ref);
      if (!name) continue;
      const seen = byName.get(name) ?? { files: new Set<string>(), scenario };
      seen.files.add(ref.file);
      byName.set(name, seen);
    }
  }
  return [...byName]
    .filter(([, { files }]) => files.size > 1)
    .map(([name, { files, scenario }]) => {
      const sorted = [...files].sort();
      const list = `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
      return problem(
        "W-TEST-NAME",
        sorted[0] as string,
        null,
        `Marked tests in ${list} are ${sorted.length === 2 ? "both" : "all"} named ${name}, so verify can't tell their results apart. Rename one.`,
        scenario,
      );
    });
}

function architectureProblems(model: Model, facts: Facts): Problem[] {
  const arch = model.knowledge.architecture;
  if (!arch.reconciled_at || !facts.git.available) return [];
  // Commits that only change Azimuth's records can't make the architecture out of date.
  const behind = codeCommitsAfter(arch.reconciled_at, facts);
  if (behind === null || behind.count <= model.config.git.arch_stale_after_commits) return [];
  return [
    problem(
      "W-ARCH-STALE",
      arch.file,
      null,
      `${behind.count} ${behind.code ? "code commits" : "commits"} since architecture.md was last reconciled (${arch.reconciled_at}).`,
    ),
  ];
}

/** Errors first, then by file, line and code, so output is stable. */
export function sortProblems(problems: Problem[]): Problem[] {
  return [...problems].sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1) ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.code.localeCompare(b.code),
  );
}
