import { emptyGitFacts, type Facts, type GitFacts } from "../../src/core/facts";
import { loadProject, type Model } from "../../src/core/model";
import { MINIMAL_CONFIG, writeTree } from "./tree";

export interface TaskSpec {
  id: string;
  status?: string;
  covers?: string[];
  after?: string[];
  verify?: string;
  note?: string;
  /** Written as the task's `files` when given. */
  files?: string[];
}

export interface FeatureSpec {
  id: string;
  slug?: string;
  status: string;
  title?: string;
  extra?: Record<string, string>;
  /** Story → scenario kinds, e.g. { "ST-001.1": ["happy", "negative"] }. */
  stories?: Record<string, string[]>;
  tasks?: TaskSpec[];
  impact?: { path: string; change: string }[];
  /** Log transitions as `at from→to` lines. Defaults to a path from idea to the status. */
  log?: string;
  /** Omit spec files (an idea). */
  ideaOnly?: boolean;
}

const PATH: Record<string, string[]> = {
  idea: [],
  draft: ["idea", "draft"],
  approved: ["idea", "draft", "approved"],
  "in-progress": ["idea", "draft", "approved", "in-progress"],
  verifying: ["idea", "draft", "approved", "in-progress", "verifying"],
  done: ["idea", "draft", "approved", "in-progress", "verifying", "done"],
  deferred: ["idea", "deferred"],
  cancelled: ["idea", "cancelled"],
};

function defaultLog(status: string): string {
  const steps = PATH[status] ?? [];
  const lines: string[] = [];
  for (let i = 1; i < steps.length; i++) {
    lines.push(`## 2026-10-0${i}T10:00:00Z · agent · transition\n${steps[i - 1]} → ${steps[i]}\n`);
  }
  return lines.join("\n");
}

export function featureFiles(spec: FeatureSpec): Record<string, string> {
  const dir = `.azimuth/features/${spec.id}-${spec.slug ?? "thing"}/`;
  const fields: Record<string, string> = {
    id: spec.id,
    title: spec.title ?? `Feature ${spec.id}`,
    status: spec.status,
    size: "M",
    created: "2026-10-01",
    ...spec.extra,
  };
  const frontmatter = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const files: Record<string, string> = {
    [`${dir}feature.md`]: `---\n${frontmatter}\n---\n## Objective\nDo ${spec.id}.\n`,
    [`${dir}log.md`]: spec.log ?? defaultLog(spec.status),
  };
  if (spec.ideaOnly) return files;
  const num = spec.id.slice(2);
  const stories = spec.stories ?? { [`ST-${num}.1`]: ["happy", "negative"] };
  const storyText: string[] = [];
  const scenarioIds: string[] = [];
  for (const [storyId, kinds] of Object.entries(stories)) {
    storyText.push(`## ${storyId} · Story\n**Intent:** As a user, I want it so that it works.\n`);
    kinds.forEach((kind, i) => {
      const sid = `${storyId.replace("ST-", "S-")}.${i + 1}`;
      scenarioIds.push(sid);
      storyText.push(
        `### ${sid} · Scenario {${kind}}\n- **GIVEN** a\n- **WHEN** b\n- **THEN** c = 1\n`,
      );
    });
  }
  const tasks = spec.tasks ?? [{ id: `T-${num}.1`, covers: scenarioIds }];
  const taskYaml = tasks
    .map((t) =>
      [
        `  - id: ${t.id}`,
        `    title: Task ${t.id}`,
        `    status: ${t.status ?? "todo"}`,
        `    after: [${(t.after ?? []).join(", ")}]`,
        `    covers: [${(t.covers ?? []).join(", ")}]`,
        t.files ? `    files: [${t.files.map((f) => JSON.stringify(f)).join(", ")}]` : null,
        `    verify: ${t.verify ?? "pnpm test"}`,
        t.note ? `    note: ${t.note}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  const impact = (spec.impact ?? [{ path: "src/app.ts", change: "modify" }])
    .map((e) => `  - path: ${e.path}\n    change: ${e.change}`)
    .join("\n");
  files[`${dir}impact.md`] = `---\nfiles:\n${impact}\n---\n`;
  files[`${dir}stories.md`] = storyText.join("\n");
  files[`${dir}contract.md`] = "## Types\n```ts\ntype A = 1;\n```\n";
  files[`${dir}plan.md`] = `---\ntasks:\n${taskYaml}\n---\n`;
  return files;
}

export function makeFacts(
  overrides: Partial<Omit<Facts, "git">> & { git?: Partial<GitFacts> } = {},
): Facts {
  return {
    now: overrides.now ?? new Date("2026-10-18T12:00:00Z"),
    git: { ...emptyGitFacts(), ...overrides.git },
    tests: overrides.tests ?? new Map(),
    exists: overrides.exists ?? (() => true),
    sesLastSeen: overrides.sesLastSeen ?? new Map(),
  };
}

export function loadTree(
  files: Record<string, string>,
  config = MINIMAL_CONFIG,
): { model: Model; root: string; write: (p: string, c: string) => void; cleanup: () => void } {
  const tree = writeTree({ ".azimuth/config.yaml": config, ...files });
  return {
    model: loadProject(tree.root),
    root: tree.root,
    write: tree.write,
    cleanup: tree.cleanup,
  };
}
