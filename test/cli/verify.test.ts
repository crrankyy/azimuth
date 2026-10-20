import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const T1: TaskSpec = {
  id: "T-001.1",
  status: "in-progress",
  covers: ["S-001.1.1"],
  verify: "echo S-001.1.1 ok",
};

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

/** A project whose F-001 is in progress with T-001.1; `verify` is config.yaml's verify section. */
function project(verify: string): string {
  const tree = writeTree({
    ".azimuth/config.yaml": `${MINIMAL_CONFIG}verify:\n${verify}`,
    ...featureFiles({ id: "F-001", status: "in-progress", tasks: [T1] }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

/** Output lines with each `in <n>s` duration replaced by `in <n>s`. */
const lines = (out: string) =>
  out
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.replace(/ in \d+\.\ds\b/, " in <n>s"));

const runJson = (root: string, id: string) =>
  JSON.parse(readFileSync(join(root, ".azimuth/cache/runs", `${id}.json`), "utf8")) as Record<
    string,
    unknown
  >;

describe("ST-018.4 azimuth verify after a failed prebuild", () => {
  // stderr isn't compared: the disk warning depends on the free space of the machine running it.
  it("S-018.4.3 exits 1 after a failed prebuild even when its run passes", async () => {
    const root = project(
      `  prebuild: ${JSON.stringify("echo no compiler; exit 2")}\n  prebuild_failure: continue\n`,
    );
    const r = await runCli(root, ["verify", "T-001.1"]);
    expect(r.code).toBe(1);
    expect(lines(r.out)).toEqual([
      "prebuild: echo no compiler; exit 2",
      "prebuild failed (exit 2) in <n>s",
      "    no compiler",
      "T-001.1: echo S-001.1.1 ok",
      "R-0001 T-001.1 passed in <n>s after a failed prebuild",
    ]);
    const run = runJson(root, "R-0001");
    expect(run.ok).toBe(true);
    expect(run.prebuild).toMatchObject({ ok: false });
  });
});
