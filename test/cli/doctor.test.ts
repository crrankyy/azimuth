import { describe, expect, it } from "vitest";
import { pluginCheck } from "../../src/cli/commands/harness";

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
