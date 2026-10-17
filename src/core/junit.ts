import type { CoverageStatus, VerifyRun } from "./types";

const SCENARIO = /S-\d{3}\.\d+\.\d+/g;

function attr(tag: string, name: string): string {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return match
    ? (match[1] ?? "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    : "";
}

/** Per-scenario results and totals from a JUnit XML report (enough XML for real reporters). */
export function parseJunit(xml: string): {
  scenarios: Map<string, CoverageStatus>;
  summary: NonNullable<VerifyRun["junit"]>;
} {
  const scenarios = new Map<string, CoverageStatus>();
  const summary = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  const cases = xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g);
  for (const m of cases) {
    const head = m[1] ?? "";
    const inner = m[3] ?? "";
    summary.tests++;
    let status: CoverageStatus = "passing";
    if (/<failure\b/.test(inner)) {
      summary.failures++;
      status = "failing";
    } else if (/<error\b/.test(inner)) {
      summary.errors++;
      status = "failing";
    } else if (/<skipped\b/.test(inner)) {
      summary.skipped++;
      status = "not-run";
    }
    const label = `${attr(head, "classname")} ${attr(head, "name")}`;
    for (const id of label.match(SCENARIO) ?? []) {
      // A scenario with several tests fails if any of them fails.
      if (scenarios.get(id) === "failing") continue;
      scenarios.set(id, status);
    }
  }
  return { scenarios, summary };
}

const FAIL = /\b(FAIL|FAILED|failed|Error|ERROR)\b|✗|×|✕/;
const PASS = /\b(PASS|passed|ok)\b|✓|✔/;

/**
 * Scenario results inferred from plain test output when no JUnit report exists: a passing run
 * passes every covered scenario; a failing run fails covered scenarios unless the output shows
 * them passing.
 */
export function scenariosFromOutput(
  output: string,
  ok: boolean,
  covers: string[],
): Map<string, CoverageStatus> {
  const result = new Map<string, CoverageStatus>();
  if (ok) {
    for (const id of covers) result.set(id, "passing");
    return result;
  }
  const seen = new Map<string, CoverageStatus>();
  for (const line of output.split("\n")) {
    for (const id of line.match(SCENARIO) ?? []) {
      if (FAIL.test(line)) seen.set(id, "failing");
      else if (PASS.test(line) && seen.get(id) !== "failing") seen.set(id, "passing");
    }
  }
  for (const id of covers) result.set(id, seen.get(id) ?? "failing");
  for (const [id, status] of seen) if (!result.has(id)) result.set(id, status);
  return result;
}
