import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  anySessionOpen,
  appendLive,
  processAlive,
  sessionOpen,
  type LiveRecord,
  type OpenCheck,
} from "../../src/core/live";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const NOW = new Date("2026-10-18T12:00:00Z");
const HOUR = 3_600_000;
const ago = (hours: number) =>
  new Date(NOW.getTime() - hours * HOUR).toISOString().replace(/\.\d{3}Z$/, "Z");
const check = (running: number[] = [4242]): OpenCheck => ({
  now: NOW,
  idleMs: 2 * HOUR,
  alive: (pid) => running.includes(pid),
});

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

describe("sessionOpen", () => {
  it("counts a session whose process runs as open, however long it has been quiet", () => {
    expect(sessionOpen([{ kind: "start", at: ago(10), pid: 4242 }], check())).toBe(true);
  });

  it("S-001.1.2 doesn't count a session that ended, until it starts again", () => {
    const ended: LiveRecord[] = [
      { kind: "start", at: ago(1), pid: 4242 },
      { kind: "end", at: ago(0.5), reason: "prompt_input_exit" },
    ];
    expect(sessionOpen(ended, check())).toBe(false);
    expect(sessionOpen([...ended, { kind: "start", at: ago(0.1), pid: 4242 }], check())).toBe(true);
  });

  it("S-001.1.3 doesn't count a session whose process is gone", () => {
    expect(sessionOpen([{ kind: "start", at: ago(0.1), pid: 4242 }], check([]))).toBe(false);
  });

  it("S-001.1.4 keeps the idle rule for a session without a process ID", () => {
    expect(sessionOpen([{ kind: "start", at: ago(3) }], check())).toBe(false);
    expect(sessionOpen([{ kind: "start", at: ago(1) }], check())).toBe(true);
  });

  it("follows the latest process ID, including one recorded by a prompt", () => {
    const records: LiveRecord[] = [
      { kind: "start", at: ago(5), pid: 1111 },
      { kind: "prompt", at: ago(4), pid: 4242 },
    ];
    expect(sessionOpen(records, check([4242]))).toBe(true);
    expect(sessionOpen(records, check([1111]))).toBe(false);
  });

  it("stops trusting a process ID once the log is a day old", () => {
    expect(sessionOpen([{ kind: "start", at: ago(25), pid: 4242 }], check())).toBe(false);
  });
});

describe("anySessionOpen", () => {
  it("looks at every Claude Code session of the project", () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    const now = { ...check(), now: new Date() };
    const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(anySessionOpen(tree.root, now)).toBe(false);
    appendLive(tree.root, "ended", { kind: "start", at, pid: 4242 });
    appendLive(tree.root, "ended", { kind: "end", at });
    expect(anySessionOpen(tree.root, now)).toBe(false);
    appendLive(tree.root, "open", { kind: "start", at, pid: 4242 });
    expect(anySessionOpen(tree.root, now)).toBe(true);
  });
});

describe("processAlive", () => {
  it("tells a running process from one that exited", () => {
    expect(processAlive(process.pid)).toBe(true);
    const exited = spawnSync("true").pid;
    expect(processAlive(exited)).toBe(false);
  });
});
