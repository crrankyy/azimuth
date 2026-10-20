import { afterEach, describe, expect, it } from "vitest";
import { diskCheck, hooksCheck, pluginCheck } from "../../src/cli/commands/harness";
import { appendLive } from "../../src/core/live";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const entry = (enabled: boolean, projectPath?: string) =>
  JSON.stringify([
    { id: "other@market", scope: "user", enabled: true },
    { id: "azimuth@azimuth", scope: "local", enabled, ...(projectPath ? { projectPath } : {}) },
  ]);

describe("doctor's plugin check", () => {
  it("BUG-0021 says so when the plugin is installed but not enabled for this project", () => {
    const check = pluginCheck(entry(false, "/home/dev/azimuth"));
    expect(check.ok).toBe(false);
    expect(check.text).toContain("not enabled for this project");
    expect(check.text).toContain("local scope in /home/dev/azimuth");
  });

  it("passes when the plugin is enabled here", () => {
    expect(pluginCheck(entry(true))).toEqual({
      ok: true,
      text: "Claude Code plugin azimuth@azimuth is enabled here (local scope)",
    });
  });

  it("reports a missing plugin and an unreadable list", () => {
    expect(pluginCheck("[]").ok).toBe(false);
    expect(pluginCheck("not json").ok).toBeNull();
  });
});

describe("doctor's disk check", () => {
  it("S-018.7.8 shows the free space when there is room", () => {
    expect(diskCheck({ state: "ok", free_bytes: 120_500_000_000, min_free_gb: 10 })).toEqual({
      ok: true,
      text: "120.5 GB free on the project's disk (verify.min_free_gb: 10)",
    });
  });

  it("S-018.7.9 flags a low disk with a line that doesn't fail doctor", () => {
    expect(diskCheck({ state: "low", free_bytes: 4_200_000_000, min_free_gb: 10 })).toEqual({
      ok: null,
      text: "Low disk space: 4.2 GB free on the project's disk, below verify.min_free_gb (10)",
    });
  });

  it("S-018.7.10 leaves the line out with the guard off and flags an unreadable disk", () => {
    expect(diskCheck({ state: "off" })).toBeNull();
    expect(
      diskCheck({ state: "unknown", error: "ENOSYS: function not implemented, statfs" }),
    ).toEqual({
      ok: null,
      text: "Could not read the free space on the project's disk: ENOSYS: function not implemented, statfs",
    });
  });
});

describe("doctor's hooks check", () => {
  let cleanup: (() => void) | null = null;
  afterEach(() => cleanup?.());
  const project = () => {
    const tree = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    cleanup = tree.cleanup;
    return tree.root;
  };
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  it("BUG-0080 fails inside a Claude Code session whose hooks never ran", () => {
    const root = project();
    appendLive(root, "c1", { kind: "session", at, ses: "SES-20261020-1000" });
    const check = hooksCheck(root, "c1");
    expect(check.ok).toBe(false);
    expect(check.text).toContain("/reload-plugins");
  });

  it("BUG-0080 fails inside Claude Code when the last hook record is over an hour old", () => {
    const root = project();
    const before = new Date(Date.now() - 2 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    appendLive(root, "c1", { kind: "prompt", at: before });
    appendLive(root, "c1", { kind: "session", at, ses: "SES-20261020-1000" });
    expect(hooksCheck(root, "c1").ok).toBe(false);
  });

  it("BUG-0080 passes inside a Claude Code session whose hooks ran", () => {
    const root = project();
    appendLive(root, "c1", { kind: "prompt", at });
    expect(hooksCheck(root, "c1")).toEqual({
      ok: true,
      text: "Hooks are running in this Claude Code session",
    });
  });

  it("BUG-0080 counts only hook records outside Claude Code", () => {
    const root = project();
    appendLive(root, "c1", { kind: "session", at, ses: "SES-20261020-1000" });
    expect(hooksCheck(root, null).ok).toBeNull();
    appendLive(root, "c2", { kind: "prompt", at });
    const check = hooksCheck(root, null);
    expect(check.ok).toBe(true);
    expect(check.text).toContain("Hooks are recording");
  });
});
