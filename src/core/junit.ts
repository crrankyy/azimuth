import { basename } from "node:path";
import type { TestRef } from "./facts";
import type { CoverageStatus, VerifyRun } from "./types";

const SCENARIO = /S-\d{3}\.\d+\.\d+/g;

/**
 * The name a runner prints for a test that carries a scenario marker: its function name (`fn`,
 * `def`, `func`), e.g. `inserts_text_at_cursor` in cargo's `buffer::tests::inserts_text_at_cursor`.
 * Null for titles that start with the scenario ID, which are matched by the ID instead.
 */
export function printedName(test: TestRef): string | null {
  return test.confidence === "marker" && /^[A-Za-z_]\w*$/.test(test.name) ? test.name : null;
}

function testName(test: TestRef): RegExp | null {
  const name = printedName(test);
  return name ? new RegExp(String.raw`(?<!\w)${name}(?!\w)`) : null;
}

function namePatterns(tests: Map<string, TestRef[]>): [string, RegExp][] {
  return [...tests].flatMap(([id, refs]) =>
    refs.map(testName).flatMap((pattern) => (pattern ? [[id, pattern] as [string, RegExp]] : [])),
  );
}

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

/**
 * Per-scenario results and totals from a JUnit XML report (enough XML for real reporters). A test
 * case counts for a scenario when its name holds the scenario ID or the name of a test in `tests`.
 */
export function parseJunit(
  xml: string,
  tests: Map<string, TestRef[]> = new Map(),
): {
  scenarios: Map<string, CoverageStatus>;
  summary: NonNullable<VerifyRun["junit"]>;
} {
  const scenarios = new Map<string, CoverageStatus>();
  const summary = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  const names = namePatterns(tests);
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
    const named = names.filter(([, pattern]) => pattern.test(label)).map(([id]) => id);
    for (const id of [...(label.match(SCENARIO) ?? []), ...named]) {
      // A scenario with several tests fails if any of them fails.
      if (scenarios.get(id) === "failing") continue;
      scenarios.set(id, status);
    }
  }
  return { scenarios, summary };
}

const FAIL = /\b(FAIL|FAILED|failed|Error|ERROR)\b|✗|×|✕/;
const PASS = /\b(PASS|PASSED|passed|ok)\b|✓|✔/;
/** Skipped tests: Vitest `↓`, Jest `○`, pytest `SKIPPED`, `go test` `--- SKIP`, cargo `... ignored`. */
const SKIP = /↓|○|\bSKIP(?:PED)?\b|\.\.\. ignored\b/;
const passedLine = (line: string) => PASS.test(line) && !SKIP.test(line);

/**
 * Scenario results inferred from plain test output when no JUnit report exists. A passing run
 * passes the covered scenarios its output shows it ran: by scenario ID, by a test's name on a
 * passing line (`test buffer::tests::inserts_text_at_cursor ... ok`), or by a test file's name. A
 * failing run fails covered scenarios unless the output shows them passing.
 */
export function scenariosFromOutput(
  output: string,
  ok: boolean,
  covers: string[],
  tests: Map<string, TestRef[]> = new Map(),
): Map<string, CoverageStatus> {
  const result = new Map<string, CoverageStatus>();
  const lines = output.split("\n");
  const names = namePatterns(new Map(covers.map((id) => [id, tests.get(id) ?? []])));
  if (ok) {
    // A zero exit code alone proves nothing (a typecheck covers no scenario), so a scenario
    // passes only when the output shows one of its tests ran.
    const ranByName = new Set(
      names.filter(([, p]) => lines.some((l) => p.test(l) && passedLine(l))).map(([id]) => id),
    );
    for (const id of covers) {
      // Where the output names the scenario (Vitest --reporter=verbose, Jest --verbose), only a
      // line showing it passed counts: verbose reporters list skipped tests too.
      const named = lines.filter((l) => l.includes(id));
      if (named.length > 0) {
        if (named.some(passedLine)) result.set(id, "passing");
        continue;
      }
      // cargo prints every test binary it runs, even when the filter skipped all of its tests, and
      // never prints module files, so a Rust file's name says nothing about what ran.
      const files = (tests.get(id) ?? []).map((t) => t.file).filter((f) => !f.endsWith(".rs"));
      if (ranByName.has(id) || files.some((f) => output.includes(basename(f)))) {
        result.set(id, "passing");
      }
    }
    return result;
  }
  const seen = new Map<string, CoverageStatus>();
  for (const line of lines) {
    const status = FAIL.test(line) ? "failing" : PASS.test(line) ? "passing" : null;
    if (!status) continue;
    const named = names.filter(([, p]) => p.test(line)).map(([id]) => id);
    for (const id of [...(line.match(SCENARIO) ?? []), ...named]) {
      if (seen.get(id) !== "failing") seen.set(id, status);
    }
  }
  for (const id of covers) result.set(id, seen.get(id) ?? "failing");
  for (const [id, status] of seen) if (!result.has(id)) result.set(id, status);
  return result;
}
