import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../helpers/cli";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const MENTIONS = [
  "// Follows S-001.1.1 and the refund flow.",
  'it("S-001.1.1 charges the card", () => {});',
  "// S-001.1.2 waits for the bank stub.",
  "",
].join("\n");

/** F-001 with scenarios S-001.1.1 and S-001.1.2 (both titled "Scenario") and one test file. */
function project(testFile = MENTIONS): string {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    "src/app.ts": "export {};\n",
    "test/pay.test.ts": testFile,
    ...featureFiles({ id: "F-001", status: "draft" }),
  });
  cleanup = tree.cleanup;
  return tree.root;
}

describe("trace hides mention-only references", () => {
  it("S-013.2.1 hides mention-only references and counts them", async () => {
    const r = await runCli(project(), ["trace", "F-001"]);
    expect(r.out).toBe(
      [
        "S-001.1.1 not-run Scenario",
        "    test/pay.test.ts: S-001.1.1 charges the card",
        "S-001.1.2 not-run Scenario",
        "2 mention-only references hidden (--all shows them)",
        "",
      ].join("\n"),
    );
    expect(r.code).toBe(0);
  });

  it("S-013.2.2 shows them marked (mention) with --all", async () => {
    const r = await runCli(project(), ["trace", "F-001", "--all"]);
    expect(r.out).toBe(
      [
        "S-001.1.1 not-run Scenario",
        "    test/pay.test.ts: S-001.1.1 charges the card",
        "    test/pay.test.ts: // Follows S-001.1.1 and the refund flow. (mention)",
        "S-001.1.2 not-run Scenario",
        "    test/pay.test.ts: // S-001.1.2 waits for the bank stub. (mention)",
        "",
      ].join("\n"),
    );
  });

  it("S-013.2.3 prints no hint without mentions", async () => {
    const r = await runCli(project('it("S-001.1.1 charges the card", () => {});\n'), [
      "trace",
      "F-001",
    ]);
    expect(r.out).toBe(
      [
        "S-001.1.1 not-run Scenario",
        "    test/pay.test.ts: S-001.1.1 charges the card",
        "S-001.1.2 untested Scenario",
        "",
      ].join("\n"),
    );
  });

  it("S-013.2.4 keeps mention-only references in --json", async () => {
    const r = await runCli(project(), ["trace", "F-001", "--json"]);
    const rows = JSON.parse(r.out) as { scenario: string; tests: unknown[] }[];
    expect(rows.find((row) => row.scenario === "S-001.1.2")?.tests).toEqual([
      {
        file: "test/pay.test.ts",
        name: "// S-001.1.2 waits for the bank stub.",
        status: "not-run",
        confidence: "fallback",
        committed: true,
      },
    ]);
  });
});
