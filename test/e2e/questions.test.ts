import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadProject } from "../../src/core/model";
import { featureFiles } from "../helpers/project";
import { gitEnv } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const LAUNCHER = fileURLToPath(new URL("../../plugin/bin/azimuth", import.meta.url));
const CLI = fileURLToPath(new URL("../../plugin/dist/cli.mjs", import.meta.url));

let cache: string;
let cleanup: (() => void) | null = null;

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error("Run `pnpm build:cli` before the e2e tests.");
  cache = mkdtempSync(join(tmpdir(), "azimuth-cache-"));
});
afterEach(() => cleanup?.());
afterAll(() => rmSync(cache, { recursive: true, force: true }));

/** A project with feature F-001 and no questions. */
function project(config: string): string {
  const tree = writeTree({
    ".azimuth/config.yaml": config,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

/** Runs the built CLI as an agent, outside any session. */
function az(root: string, args: string[]) {
  const r = spawnSync(LAUNCHER, args, {
    cwd: root,
    env: {
      ...gitEnv(),
      HOME: process.env.HOME,
      PATH: "/usr/local/bin:/usr/bin:/bin",
      XDG_CACHE_HOME: cache,
      AZIMUTH_NO_VIEWER: "1",
      AZIMUTH_ACTOR: "agent",
      NO_COLOR: "1",
    },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const NEW_QUESTION = [
  "new",
  "question",
  "Which lock?",
  "--feature",
  "F-001",
  "--option",
  "a=Lockfile: Simple",
  "--option",
  "b=Advisory lock: Faster",
  "--recommend",
  "a",
];

describe("new question through the built CLI", () => {
  it("S-012.3.2 says the question was answered with its recommendation", () => {
    const root = project(`${MINIMAL_CONFIG}autonomy:\n  questions: proceed\n`);
    const r = az(root, NEW_QUESTION);
    expect(r.code).toBe(0);
    expect(r.out).toBe("Q-0001\n");
    expect(r.err).toBe(
      [
        "created .azimuth/questions/Q-0001.md",
        "Q-0001: answered automatically with its recommendation (a: Lockfile)",
        "Proceed with it and record it with azimuth resolve Q-0001. The user can overrule it in the viewer.",
        "",
      ].join("\n"),
    );
  });

  it("S-012.3.5 leaves the question open under ask", () => {
    const root = project(MINIMAL_CONFIG);
    const r = az(root, NEW_QUESTION);
    expect(r.code).toBe(0);
    expect(r.out).toBe("Q-0001\n");
    expect(r.err).toBe("created .azimuth/questions/Q-0001.md\n");
    expect(loadProject(root).questions.find((q) => q.id === "Q-0001")).toMatchObject({
      status: "open",
      answer: null,
    });
  });
});
