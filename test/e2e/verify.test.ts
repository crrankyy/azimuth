import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { featureFiles, type TaskSpec } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const LAUNCHER = fileURLToPath(new URL("../../plugin/bin/azimuth", import.meta.url));
const CLI = fileURLToPath(new URL("../../plugin/dist/cli.mjs", import.meta.url));

// A sleep whose argument no other process has, so stray children can be found and killed.
const LONG_SLEEP = `sleep 60.${process.pid}${Date.now() % 100_000}`;

let cache = "";
let root = "";
let cleanup: (() => void) | null = null;

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error("Run `pnpm build:cli` before the e2e tests.");
  cache = mkdtempSync(join(tmpdir(), "azimuth-cache-"));
});

afterEach(() => {
  spawnSync("pkill", ["-KILL", "-f", LONG_SLEEP]);
  cleanup?.();
  cleanup = null;
});

afterAll(() => rmSync(cache, { recursive: true, force: true }));

function env(): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env };
  // The developer's own Claude Code session would otherwise leak into the runs' `ses`.
  for (const key of ["AZIMUTH_SESSION", "AZIMUTH_CLAUDE_SESSION", "CLAUDE_CODE_SESSION_ID"]) {
    delete base[key];
  }
  return {
    ...base,
    PATH: "/usr/local/bin:/usr/bin:/bin",
    XDG_CACHE_HOME: cache,
    AZIMUTH_NO_VIEWER: "1",
    AZIMUTH_ACTOR: "agent",
    NO_COLOR: "1",
  };
}

/** A project with no runs whose F-001 is in progress with T-001.1 and T-001.2 (and `extra`). */
function project(options: { prebuild?: string; extra?: TaskSpec[] } = {}): void {
  const config = options.prebuild
    ? `${MINIMAL_CONFIG}verify:\n  prebuild: ${JSON.stringify(options.prebuild)}\n`
    : MINIMAL_CONFIG;
  const tasks: TaskSpec[] = [
    { id: "T-001.1", covers: ["S-001.1.1"], verify: "echo S-001.1.1 ok" },
    { id: "T-001.2", covers: ["S-001.1.2"], verify: "echo S-001.1.2 ok" },
    ...(options.extra ?? []),
  ];
  const tree = writeTree({
    ".azimuth/config.yaml": config,
    ...featureFiles({ id: "F-001", status: "in-progress", tasks }),
  });
  root = tree.root;
  cleanup = tree.cleanup;
}

function az(args: string[]) {
  const r = spawnSync(LAUNCHER, args, { cwd: root, env: env(), encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const exists = (path: string) => existsSync(join(root, path));
const runFiles = () => {
  const dir = join(root, ".azimuth/cache/runs");
  return existsSync(dir) ? readdirSync(dir) : [];
};

async function until<T>(read: () => T | null, what: string, deadlineMs = 10_000): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const value = read();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function childPid(): number | null {
  if (!exists("child.pid")) return null;
  const pid = Number(readFileSync(join(root, "child.pid"), "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

describe("azimuth verify (through the launcher)", () => {
  it("S-007.8.1 verifies several IDs in one call and summarises each run in a line", () => {
    project();
    const r = az(["verify", "T-001.2", "F-001", "--summary"]);
    expect(r.code).toBe(0);
    const lines = r.out.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^R-0001 T-001\.2 passed in \d+\.\ds$/);
    expect(lines[1]).toMatch(/^R-0002 T-001\.1 passed in \d+\.\ds$/);
  });

  it("S-007.8.2 exits 1 without runs when the prebuild fails", () => {
    project({ prebuild: "echo no compiler; exit 2" });
    const r = az(["verify", "T-001.1"]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^prebuild failed \(exit 2\) in \d+\.\ds\n {4}no compiler$/m);
    expect(runFiles()).toEqual([]);
  });

  it("S-007.8.3 skips the prebuild with --no-prebuild", () => {
    project({ prebuild: "touch prebuilt" });
    const r = az(["verify", "T-001.1", "--no-prebuild"]);
    expect(r.code).toBe(0);
    expect(exists("prebuilt")).toBe(false);
    const run = JSON.parse(readFileSync(join(root, ".azimuth/cache/runs/R-0001.json"), "utf8")) as {
      target: string;
    };
    expect(run.target).toBe("T-001.1");
  });

  it("S-007.8.4 keeps stdout to JSON and reports a failed prebuild on stderr", () => {
    project({ prebuild: "echo no compiler; exit 2" });
    const r = az(["verify", "T-001.1", "--json"]);
    expect(r.code).toBe(1);
    expect(r.out).toBe("[]\n");
    expect(r.err).toMatch(/^prebuild failed \(exit 2\) in \d+\.\ds\n {4}no compiler$/m);
  });

  it("S-007.8.5 stops verify and its command on SIGTERM", async () => {
    project({ extra: [{ id: "T-001.3", verify: `${LONG_SLEEP} & echo $! > child.pid; wait` }] });
    const cli = spawn(LAUNCHER, ["verify", "T-001.3"], { cwd: root, env: env(), stdio: "ignore" });
    const exited = new Promise<number | null>((resolve) => cli.on("exit", (code) => resolve(code)));
    const pid = await until(childPid, "child.pid");
    cli.kill("SIGTERM");
    expect(await exited).toBe(143);
    const gone = await until(() => {
      try {
        process.kill(pid, 0);
        return null;
      } catch (error) {
        return error as NodeJS.ErrnoException;
      }
    }, `process ${pid} to exit`);
    expect(gone.code).toBe("ESRCH");
    expect(exists(".azimuth/cache/verify.lock")).toBe(false);
    expect(runFiles()).toEqual([]);
  });
});
