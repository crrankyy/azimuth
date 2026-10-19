import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/core/config";
import { parseRun } from "../../src/core/parse/run";

const FIXTURE_RUN = fileURLToPath(
  new URL("../fixtures/hookline/.azimuth/cache/runs/R-0101.json", import.meta.url),
);

const config = (verify: string) => parseConfig(`project:\n  name: Demo\nverify:\n${verify}`);

const runFile = (extra: Record<string, unknown>) =>
  JSON.stringify({
    id: "R-0007",
    target: "T-001.1",
    command: "echo ok",
    ok: true,
    exit_code: 0,
    duration_ms: 12,
    at: "2026-10-20T09:00:00Z",
    commit: null,
    output_tail: "",
    scenarios: [],
    junit: null,
    ...extra,
  });

describe("verify config", () => {
  it("S-007.1.1 reads the prebuild and its timeout", () => {
    const { config: c, problems } = config(
      "  prebuild: cargo test --workspace --no-run\n  build_timeout_seconds: 900\n",
    );
    expect(c.verify.prebuild).toBe("cargo test --workspace --no-run");
    expect(c.verify.build_timeout_seconds).toBe(900);
    expect(c.verify.timeout_seconds).toBe(600);
    expect(problems).toEqual([]);
  });

  it("S-007.1.2 defaults the prebuild and its timeout when the keys are absent", () => {
    const { config: c, problems } = config("  timeout_seconds: 600\n");
    expect(c.verify.prebuild).toBeNull();
    expect(c.verify.build_timeout_seconds).toBe(1800);
    expect(problems).toEqual([]);
  });

  it("S-007.1.3 rejects a zero build timeout and keeps the default", () => {
    const { config: c, problems } = config("  build_timeout_seconds: 0\n");
    expect(problems.map((p) => [p.code, p.message])).toEqual([
      ["E-SCHEMA", "verify.build_timeout_seconds must be a whole number ≥ 1."],
    ]);
    expect(c.verify.build_timeout_seconds).toBe(1800);
  });
});

describe("run fields", () => {
  it("S-007.1.4 reads a run's wait and session", () => {
    const { run, problems } = parseRun(
      runFile({ waited_ms: 40000, ses: "SES-20261020-0900" }),
      ".azimuth/cache/runs/R-0007.json",
    );
    expect(run?.waited_ms).toBe(40000);
    expect(run?.ses).toBe("SES-20261020-0900");
    expect(problems).toEqual([]);
  });

  it("S-007.1.5 reads a run outside a session that didn't wait", () => {
    const { run } = parseRun(runFile({ waited_ms: 0, ses: null }), "R-0007.json");
    expect(run?.waited_ms).toBe(0);
    expect(run?.ses).toBeNull();
  });

  it("S-007.1.6 parses a run written before this feature as before", () => {
    const { run, problems } = parseRun(readFileSync(FIXTURE_RUN, "utf8"), "R-0101.json");
    expect(run).not.toBeNull();
    expect(run).not.toHaveProperty("waited_ms");
    expect(run).not.toHaveProperty("ses");
    expect(problems).toEqual([]);
  });

  it("S-007.1.7 leaves out invalid wait and session values", () => {
    const { run, problems } = parseRun(runFile({ waited_ms: "40s", ses: 42 }), "R-0007.json");
    expect(run).not.toBeNull();
    expect(run).not.toHaveProperty("waited_ms");
    expect(run).not.toHaveProperty("ses");
    expect(problems).toEqual([]);
  });
});
