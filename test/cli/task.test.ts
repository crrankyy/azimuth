import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadProject } from "../../src/core/model";
import { taskBrief } from "../../src/core/task-brief";
import { runCli } from "../helpers/cli";
import { commitAll, git, gitEnv, initRepo } from "../helpers/git";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const DIR = ".azimuth/features/F-001-thing/";
const SES = "SES-20261020-0900";
const COMMIT = ["--commit", "feat(F-001): add a"];

let root = "";
let cleanup: (() => void) | null = null;

beforeEach(() => {
  // task finish runs git with the process environment: keep the developer's hooks and signing out.
  for (const [key, value] of Object.entries(gitEnv())) {
    if (key.startsWith("GIT_") && value !== undefined) vi.stubEnv(key, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup?.();
  cleanup = null;
});

const T1: TaskSpec = {
  id: "T-001.1",
  status: "in-progress",
  covers: ["S-001.1.1", "S-001.1.2"],
  files: ["src/a.ts", "test/a.test.ts"],
  verify: "echo S-001.1.1 ok",
};

/** A git repository whose HEAD holds F-001 in progress with T-001.1 and an open session. */
function repo(task: TaskSpec = T1): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ".gitignore": ".azimuth/cache/\n",
    "src/a.ts": "export const a = 0;\n",
    "test/a.test.ts": 'it("S-001.1.1 works", () => {});\n',
    "src/other.ts": "export const other = 0;\n",
    ...featureFiles({ id: "F-001", status: "in-progress", tasks: [task] }),
    [`.azimuth/sessions/${SES}.md`]: `---\nid: ${SES}\nstarted_at: 2026-10-20T09:00:00Z\ntouched: []\n---\n## Summary\n`,
  });
  cleanup = tree.cleanup;
  root = tree.root;
  initRepo(root);
  commitAll(root, "chore: start");
  return root;
}

const write = (path: string, content: string) => writeFileSync(join(root, path), content);
const head = () => git(root, ["rev-parse", "--short=7", "HEAD"]);

function changeTaskFiles(): void {
  write("src/a.ts", "export const a = 1;\n");
  write("test/a.test.ts", 'it("S-001.1.1 works", () => { expect(a).toBe(1); });\n');
}

/** Output lines with each `in <n>s` duration replaced by `in <n>s`. */
const lines = (out: string) =>
  out
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.replace(/ in \d+\.\ds\b/, " in <n>s"));

describe("ST-009.6 azimuth task finish on the command line", () => {
  it("S-009.6.1 prints one line per step, exits 0 and records the session", async () => {
    repo();
    changeTaskFiles();
    write("src/other.ts", "export const other = 1;\n");
    const r = await runCli(root, ["task", "finish", "T-001.1", ...COMMIT], {
      AZIMUTH_SESSION: SES,
    });
    const sha = head();
    expect(r.code).toBe(0);
    expect(lines(r.out)).toEqual([
      "✓ check: F-001 has no errors",
      "✓ stage: src/a.ts, test/a.test.ts",
      "  not staged: src/other.ts",
      `✓ commit: ${sha} feat(F-001): add a`,
      "✓ verify: R-0001 passed in <n>s",
      "✓ done: T-001.1: in-progress → done",
      `✓ log: Committed ${sha}; R-0001 passed.`,
    ]);
    expect(loadProject(root).sessions.find((s) => s.id === SES)?.touched).toEqual([
      "F-001",
      "T-001.1",
    ]);
  });

  it("S-009.6.2 exits 1 after a failed verify and shows what remains", async () => {
    repo({ ...T1, verify: "echo S-001.1.1 boom; exit 1" });
    changeTaskFiles();
    const r = await runCli(root, ["task", "finish", "T-001.1", ...COMMIT]);
    const sha = head();
    expect(r.code).toBe(1);
    expect(lines(r.out).slice(-4)).toEqual([
      "✗ verify: R-0001 failed (exit 1) in <n>s",
      "    S-001.1.1 boom",
      "- done: not run",
      `✓ log: Committed ${sha}; R-0001 failed (exit 1).`,
    ]);
  });

  it("S-009.6.3 prints the result as JSON with --json", async () => {
    repo();
    changeTaskFiles();
    const r = await runCli(root, ["task", "finish", "T-001.1", ...COMMIT, "--json"]);
    expect(r.code).toBe(0);
    const result = JSON.parse(r.out) as Record<string, unknown> & {
      steps: { step: string; status: string }[];
    };
    expect(result).toMatchObject({
      task: "T-001.1",
      feature: "F-001",
      ok: true,
      commit: head(),
      run: "R-0001",
      staged: ["src/a.ts", "test/a.test.ts"],
      not_staged: [],
      interrupted: false,
    });
    expect(result.steps.map((s) => s.step)).toEqual([
      "check",
      "stage",
      "commit",
      "verify",
      "done",
      "log",
    ]);
    expect(result.steps.every((s) => s.status === "done")).toBe(true);
  });

  it("S-009.6.4 exits 2 on usage errors without committing", async () => {
    repo();
    changeTaskFiles();
    const before = head();
    const missingCommit = await runCli(root, ["task", "finish", "T-001.1"]);
    const notTask = await runCli(root, ["task", "finish", "F-001", "--commit", "x"]);
    const unknownAction = await runCli(root, ["task", "close", "T-001.1", "--commit", "x"]);
    expect([missingCommit.code, notTask.code, unknownAction.code]).toEqual([2, 2, 2]);
    expect(head()).toBe(before);
    expect(missingCommit.err.startsWith('task finish needs --commit "<message>".')).toBe(true);
    expect(notTask.err.startsWith("F-001 is not a task ID.")).toBe(true);
    expect(unknownAction.err.startsWith('Unknown task action "close". Use finish.')).toBe(true);
  });

  it("BUG-0074 prints the skipped commit and the ignored message on a rerun", async () => {
    repo({ ...T1, verify: "grep -q fixed src/other.ts && echo S-001.1.1 ok" });
    changeTaskFiles();
    const first = await runCli(root, ["task", "finish", "T-001.1", ...COMMIT]);
    const sha = head();
    expect(first.code).toBe(1);
    // Another lane's fix, committed with the pending records (the failed run's log note).
    write("src/other.ts", "export const other = 'fixed';\n");
    commitAll(root, "fix: repair the other lane");
    const r = await runCli(root, [
      "task",
      "finish",
      "T-001.1",
      "--commit",
      "feat(F-001): add a again",
    ]);
    expect(r.code).toBe(0);
    expect(lines(r.out)).toEqual([
      "✓ check: F-001 has no errors",
      "✓ stage: nothing left to stage: none of T-001.1's files and none of F-001's records changed",
      `✓ commit: skipped: ${sha} feat(F-001): add a already commits T-001.1`,
      "    --commit message ignored: feat(F-001): add a again",
      "✓ verify: R-0002 passed in <n>s",
      "✓ done: T-001.1: in-progress → done",
      `✓ log: Committed ${sha}; R-0002 passed.`,
    ]);
  });
});

/** contract.md's "Brief example" project, plus the impact.md that gives the model a spec. */
function exampleProject(): string {
  const tree = writeTree({
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}stack:\n  languages: [typescript]\n`,
    [`${DIR}feature.md`]:
      "---\nid: F-001\ntitle: Parse headings\nstatus: in-progress\nsize: M\ncreated: 2026-10-01\n---\n## Objective\nFind headings.\n\n## Invariants\n- The parser never allocates per character.\n",
    [`${DIR}impact.md`]: "---\nfiles: []\n---\n",
    [`${DIR}stories.md`]: [
      "# F-001: Stories",
      "",
      "## ST-001.1 · Headings",
      "**Intent:** As a reader, I want headings found, so that the outline works.",
      "",
      "### S-001.1.1 · Finds an ATX heading {happy}",
      "- **GIVEN** the text `# Hi`",
      "- **WHEN** it is parsed",
      "- **THEN** one heading of level 1 is returned",
      "- **AND** its text is `Hi`",
      "",
      "### S-001.1.2 · Ignores a hash without a space {negative}",
      "- **GIVEN** the text `#Hi`",
      "- **WHEN** it is parsed",
      "- **THEN** no heading is returned",
      "",
    ].join("\n"),
    [`${DIR}contract.md`]:
      "---\nlanguage: typescript\n---\n# F-001: Contract\n\n## Public signatures\n\n```ts\nexport function headings(text: string): Heading[];\n```\n",
    [`${DIR}plan.md`]: [
      "---",
      "tasks:",
      "  - id: T-001.1",
      "    title: Heading type",
      "    status: done",
      "    covers: []",
      "    files: [src/heading.ts]",
      "    verify: pnpm typecheck",
      "  - id: T-001.2",
      "    title: Heading recognizer (red → green)",
      "    status: in-progress",
      "    after: [T-001.1]",
      "    covers: [S-001.1.1, S-001.1.2]",
      "    files: [src/headings.ts, test/headings.test.ts]",
      "    verify: pnpm exec vitest run test/headings.test.ts --reporter=verbose",
      "---",
      "",
    ].join("\n"),
    [`${DIR}notes.md`]:
      "# F-001: Notes\n\n### T-001.1 · 2026-10-20\n\nHeading levels are 1-based.\n",
  });
  cleanup = tree.cleanup;
  root = tree.root;
  return root;
}

describe("ST-009.8 azimuth brief on the command line", () => {
  it("S-009.8.1 prints the brief and one newline", async () => {
    exampleProject();
    const r = await runCli(root, ["brief", "T-001.2"]);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`${taskBrief(loadProject(root), "T-001.2")}\n`);
    expect(r.out.startsWith("# T-001.2 · Heading recognizer (red → green)\n\n")).toBe(true);
  });

  it("S-009.8.2 wraps the brief in JSON with --json", async () => {
    exampleProject();
    const r = await runCli(root, ["brief", "T-001.2", "--json"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({
      task: "T-001.2",
      feature: "F-001",
      text: taskBrief(loadProject(root), "T-001.2"),
    });
  });

  it("S-009.8.3 exits 1 for an unknown task and 2 for a non-task ID", async () => {
    exampleProject();
    const unknown = await runCli(root, ["brief", "T-001.9"]);
    const notTask = await runCli(root, ["brief", "F-001"]);
    expect(unknown).toEqual({
      code: 1,
      out: "",
      err: "✗ T-001.9 is not a task in .azimuth/features/F-001-thing/plan.md.\n",
    });
    expect(notTask.code).toBe(2);
    expect(notTask.err.startsWith("F-001 is not a task ID.")).toBe(true);
  });
});
