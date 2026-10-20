import { describe, expect, it } from "vitest";
import { testFileMatcher } from "../../src/core/glob";

describe("testFileMatcher", () => {
  it("S-019.1.3 excludes a path that a ! glob matches from the test files", () => {
    const isTest = testFileMatcher(["test/**/*.test.ts", "!test/fixtures/**"]);
    expect(["test/core/a.test.ts", "test/fixtures/demo/a.test.ts", "src/a.ts"].map(isTest)).toEqual(
      [true, false, false],
    );
  });
});
