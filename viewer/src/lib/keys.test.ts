import { describe, expect, it } from "vitest";
import { keyTracker } from "./keys";

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
