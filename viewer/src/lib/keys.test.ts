import { describe, expect, it } from "vitest";
import { GOTO, keyTracker } from "./keys";
import { href } from "./router";

describe("keyTracker", () => {
  it("BUG-0009 marks the key right after g as part of a go-to shortcut", () => {
    const keys = keyTracker();
    keys.record("g", 1_000);
    keys.record("a", 1_300);
    expect(keys.afterG(1_300)).toBe(true);
    keys.record("a", 1_500);
    expect(keys.afterG(1_500)).toBe(false);
  });

  it("forgets a g pressed too long ago", () => {
    const keys = keyTracker();
    keys.record("g", 1_000);
    keys.record("a", 2_300);
    expect(keys.afterG(2_300)).toBe(false);
  });
});

describe("F-015 go-to keys", () => {
  it("S-015.1.3 sends g a to Agents and g t to Activity", () => {
    expect(GOTO.a && href(GOTO.a)).toBe("#/agents");
    expect(GOTO.t && href(GOTO.t)).toBe("#/activity");
    expect(Object.keys(GOTO).filter((key) => GOTO[key] === "activity")).toEqual(["t"]);
  });
});
