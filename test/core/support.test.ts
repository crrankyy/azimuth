import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configYaml, detectStack, initProject, upsertBlock } from "../../src/core/init";
import type { TestRef } from "../../src/core/facts";
import { parseJunit, scenariosFromOutput } from "../../src/core/junit";
import { loadProject } from "../../src/core/model";
import { parseAsBuilt } from "../../src/core/parse/feature";
import { parseFrontmatter } from "../../src/core/frontmatter";
import { AGENTS_BLOCK, CLAUDE_BLOCK } from "../../src/core/protocol";
import { fill, TEMPLATES } from "../../src/core/templates";
import { format } from "prettier";
import { writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const ref = (file: string, name: string): TestRef => ({ file, name, confidence: "marker" });

describe("parseJunit", () => {
  it("maps test cases to scenarios and counts results", () => {
    const xml = `<testsuites><testsuite>
      <testcase classname="src/retry.test.ts" name="S-005.1.1 retries a 503" time="0.01"/>
      <testcase classname="src/retry.test.ts" name="S-005.2.1 exhausts &amp; stops"><failure message="x">boom</failure></testcase>
      <testcase classname="src/retry.test.ts" name="S-005.2.1 emits once"/>
      <testcase classname="src/retry.test.ts" name="S-005.3.1 lease"><skipped/></testcase>
      <testcase classname="src/retry.test.ts" name="helper works"/>
    </testsuite></testsuites>`;
    const { scenarios, summary } = parseJunit(xml);
    expect(Object.fromEntries(scenarios)).toEqual({
      "S-005.1.1": "passing",
      "S-005.2.1": "failing",
      "S-005.3.1": "not-run",
    });
    expect(summary).toEqual({ tests: 5, failures: 1, errors: 0, skipped: 1 });
  });

  it("BUG-0025 maps test cases by the name of the test a scenario marker sits on", () => {
    // cargo nextest's report: Rust test names can't hold a scenario ID.
    const xml = `<testsuites><testsuite name="rustprobe">
      <testcase classname="rustprobe" name="buffer::tests::inserts_text_at_cursor"/>
      <testcase classname="rustprobe" name="buffer::tests::inserts_at_end"><failure>left != right</failure></testcase>
      <testcase classname="rustprobe" name="buffer::tests::inserts_at_end_twice"/>
    </testsuite></testsuites>`;
    const tests = new Map([
      ["S-900.1.1", [ref("src/buffer.rs", "inserts_text_at_cursor")]],
      ["S-900.1.2", [ref("src/buffer.rs", "inserts_at_end")]],
    ]);
    expect(Object.fromEntries(parseJunit(xml, tests).scenarios)).toEqual({
      "S-900.1.1": "passing",
      "S-900.1.2": "failing",
    });
  });
});

// `cargo test` output, taken from real runs, for a crate with a unit test module in src/buffer.rs
// and an integration test in tests/render.rs.
const CARGO_PASS = `     Running unittests src/lib.rs (target/debug/deps/rustprobe-2209c88278124908)
running 2 tests
test buffer::tests::handles_wide_chars ... ignored
test buffer::tests::inserts_text_at_cursor ... ok
test result: ok. 1 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
     Running tests/render.rs (target/debug/deps/render-af7acaa8b9f6368b)
running 1 test
test renders_heading ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
`;
// `cargo test no_such_test`: every binary is listed, none of its tests ran.
const CARGO_NONE = `     Running unittests src/lib.rs (target/debug/deps/rustprobe-2209c88278124908)
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 3 filtered out; finished in 0.00s
     Running tests/render.rs (target/debug/deps/render-af7acaa8b9f6368b)
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.00s
`;
const CARGO_FAIL = `     Running unittests src/lib.rs (target/debug/deps/rustprobe-2209c88278124908)
running 2 tests
test buffer::tests::inserts_text_at_cursor ... ok
test buffer::tests::inserts_at_end ... FAILED

failures:

---- buffer::tests::inserts_at_end stdout ----

thread 'buffer::tests::inserts_at_end' (4898988) panicked at src/buffer.rs:11:27:
assertion \`left == right\` failed
  left: "abc"
 right: "abX"

failures:
    buffer::tests::inserts_at_end

test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

error: test failed, to rerun pass \`--lib\`
`;

describe("scenariosFromOutput", () => {
  it("BUG-0025 passes Rust scenarios whose tests cargo reports as ok", () => {
    const tests = new Map([
      ["S-900.1.1", [ref("src/buffer.rs", "inserts_text_at_cursor")]],
      ["S-900.1.2", [ref("src/buffer.rs", "handles_wide_chars")]],
      ["S-900.2.1", [ref("tests/render.rs", "renders_heading")]],
    ]);
    const covers = ["S-900.1.1", "S-900.1.2", "S-900.2.1"];
    expect(Object.fromEntries(scenariosFromOutput(CARGO_PASS, true, covers, tests))).toEqual({
      "S-900.1.1": "passing",
      "S-900.2.1": "passing",
    });
  });

  it("BUG-0025 passes no Rust scenario when cargo's filter ran none of its tests", () => {
    const tests = new Map([
      ["S-900.1.1", [ref("src/lib.rs", "parses_empty_input")]],
      ["S-900.2.1", [ref("tests/render.rs", "renders_heading")]],
    ]);
    const covers = ["S-900.1.1", "S-900.2.1"];
    expect(scenariosFromOutput(CARGO_NONE, true, covers, tests).size).toBe(0);
  });

  it("BUG-0025 fails only the scenarios whose tests failed in a failing cargo run", () => {
    const tests = new Map([
      ["S-900.1.1", [ref("src/buffer.rs", "inserts_text_at_cursor")]],
      ["S-900.1.2", [ref("src/buffer.rs", "inserts_at_end")]],
      ["S-900.2.1", [ref("tests/render.rs", "renders_heading")]],
    ]);
    const covers = ["S-900.1.1", "S-900.1.2", "S-900.2.1"];
    expect(Object.fromEntries(scenariosFromOutput(CARGO_FAIL, false, covers, tests))).toEqual({
      "S-900.1.1": "passing",
      "S-900.1.2": "failing",
      // cargo stops before tests/render.rs, so its scenario didn't pass.
      "S-900.2.1": "failing",
    });
  });

  it("BUG-0025 matches whole test names only", () => {
    const tests = new Map([["S-900.1.1", [ref("src/buffer.rs", "inserts_text")]]]);
    expect(scenariosFromOutput(CARGO_PASS, true, ["S-900.1.1"], tests).size).toBe(0);
  });

  it("BUG-0025 reads per-test results from go test -v and pytest -v", () => {
    const tests = new Map([
      ["S-900.1.1", [ref("count_test.go", "TestCountsFiles")]],
      ["S-900.1.2", [ref("count_test.go", "TestSkipsDirs")]],
      ["S-900.2.1", [ref("tests/test_count.py", "test_counts_lines")]],
      ["S-900.2.2", [ref("tests/test_count.py", "test_counts_words")]],
    ]);
    const output = [
      "=== RUN   TestCountsFiles",
      "--- PASS: TestCountsFiles (0.00s)",
      "=== RUN   TestSkipsDirs",
      "--- FAIL: TestSkipsDirs (0.00s)",
      "tests/test_count.py::test_counts_lines PASSED                    [ 50%]",
      "tests/test_count.py::test_counts_words FAILED                    [100%]",
    ].join("\n");
    expect(
      Object.fromEntries(scenariosFromOutput(output, false, [...tests.keys()], tests)),
    ).toEqual({
      "S-900.1.1": "passing",
      "S-900.1.2": "failing",
      "S-900.2.1": "passing",
      "S-900.2.2": "failing",
    });
  });

  it("BUG-0064 credits the tests Vitest's verbose reporter ran, not the ones it skipped", () => {
    // Real `vitest run --reporter=verbose -t …` output (Vitest 5.0.5), outside a terminal.
    const output = [
      " ↓ test/core/live.test.ts > sessionOpen > S-001.1.2 doesn't count a session that ended, until it starts again",
      " ✓ test/core/live.test.ts > F-005 subagent assignments > S-005.2.1 matches a subagent exactly by the Agent tool's response 3ms",
      " ✓ test/core/live.test.ts > F-005 subagent assignments > S-005.2.2 matches running subagents to launches in order 1ms",
      " ↓ test/core/live.test.ts > F-005 subagent assignments > S-005.2.3 lets an exact match override the order",
      " Test Files  1 passed (1)",
      "      Tests  2 passed | 12 skipped (14)",
    ].join("\n");
    const covers = ["S-001.1.2", "S-005.2.1", "S-005.2.2", "S-005.2.3"];
    const tests = new Map<string, TestRef[]>(
      covers.map((id) => [id, [ref("test/core/live.test.ts", `${id} title`)]]),
    );
    expect(Object.fromEntries(scenariosFromOutput(output, true, covers, tests))).toEqual({
      "S-005.2.1": "passing",
      "S-005.2.2": "passing",
    });
  });

  it("BUG-0016 passes a covered scenario only when the output shows its test ran", () => {
    const tests = new Map([
      ["S-900.1.1", [ref("src/count.test.ts", "S-900.1.1 counts lines")]],
      ["S-900.1.2", [ref("src/count.test.ts", "S-900.1.2 counts words")]],
      ["S-900.1.3", [ref("src/format.test.ts", "S-900.1.3 formats totals")]],
    ]);
    const covers = ["S-900.1.1", "S-900.1.2", "S-900.1.3", "S-900.1.4"];
    // vitest's default reporter names test files, not tests.
    const output = " ✓ src/count.test.ts (12 tests) 4ms\n ✓ S-900.1.4 named directly\n";
    expect(Object.fromEntries(scenariosFromOutput(output, true, covers, tests))).toEqual({
      "S-900.1.1": "passing",
      "S-900.1.2": "passing",
      "S-900.1.4": "passing",
    });
  });

  it("BUG-0016 records nothing for a passing command that ran no tests", () => {
    const tests = new Map([["S-900.1.1", [ref("src/count.test.ts", "S-900.1.1 counts lines")]]]);
    const output = "$ tsc --noEmit\n";
    expect(scenariosFromOutput(output, true, ["S-900.1.1"], tests).size).toBe(0);
  });

  it("uses failing and passing lines on failure, failing the rest", () => {
    const output = " ✓ S-001.1.1 works\n FAIL S-001.1.2 breaks\n";
    expect(
      Object.fromEntries(
        scenariosFromOutput(output, false, ["S-001.1.1", "S-001.1.2", "S-001.1.3"]),
      ),
    ).toEqual({
      "S-001.1.1": "passing",
      "S-001.1.2": "failing",
      "S-001.1.3": "failing",
    });
  });
});

describe("detectStack", () => {
  it("recognizes Python, Rust and Go projects", () => {
    const tree = writeTree({
      "pyproject.toml": "[tool.ruff]\n",
      "uv.lock": "",
      "Cargo.toml": "",
      "go.mod": "",
    });
    cleanup = tree.cleanup;
    const d = detectStack(tree.root);
    expect(d.mode).toBe("brownfield");
    expect(d.languages).toEqual(["python", "rust", "go"]);
    expect(d.commands).toMatchObject({
      test: "uv run pytest",
      lint: "uv run ruff check .",
      build: "cargo build",
    });
    expect(d.testGlobs).toContain("**/*_test.go");
    expect(configYaml(d)).toContain("display: [Python, Rust, Go]");
  });

  it("names TypeScript the way it is written", () => {
    const tree = writeTree({ "package.json": "{}", "tsconfig.json": "{}" });
    cleanup = tree.cleanup;
    expect(configYaml(detectStack(tree.root))).toContain("display: [TypeScript]");
  });

  it("treats an empty folder as greenfield", () => {
    const tree = writeTree({ "README.md": "# New\n" });
    cleanup = tree.cleanup;
    expect(detectStack(tree.root).mode).toBe("greenfield");
  });
});

describe("upsertBlock", () => {
  const block = "<!-- azimuth:start -->\nNEW\n<!-- azimuth:end -->";
  it("appends, then replaces in place", () => {
    const once = upsertBlock("# Project\n\nNotes.\n", block);
    expect(once).toBe(`# Project\n\nNotes.\n\n${block}\n`);
    const updated = upsertBlock(once.replace("NEW", "OLD"), block);
    expect(updated).toBe(once);
    expect(upsertBlock(null, block)).toBe(`${block}\n`);
  });

  it("writes blocks that Prettier leaves unchanged", async () => {
    for (const b of [CLAUDE_BLOCK, AGENTS_BLOCK]) {
      const file = upsertBlock("# Project\n", b);
      expect(await format(file, { parser: "markdown" })).toBe(file);
    }
  });
});

describe("format references in a new project", () => {
  it("BUG-0019 shows how modules, glossary terms and the as-built are written", () => {
    const tree = writeTree({ "README.md": "# New\n" });
    cleanup = tree.cleanup;
    initProject(tree.root, { now: new Date("2026-10-18T12:00:00Z") });
    const read = (p: string) => readFileSync(join(tree.root, ".azimuth", p), "utf8");
    expect(read("project/architecture.md")).toMatch(
      /modules: \[\] # .*name: .*path: .*depends_on:/,
    );
    expect(read("project/glossary.md")).toMatch(/terms: \[\] # .*term: .*definition: .*aliases:/);
    // The examples are comments: the stubs still load with no modules or terms.
    const model = loadProject(tree.root);
    expect(model.knowledge.architecture.modules).toEqual([]);
    expect(model.problems).toEqual([]);
    const asBuilt = fill(read("templates/feature/as-built.md"), {
      id: "F-001",
      date: "2026-10-18",
    });
    const parsed = parseAsBuilt(asBuilt, "as-built.md", "F-001");
    expect(parsed.problems).toEqual([]);
    expect(parsed.asBuilt?.completed_at).toBe("2026-10-18");
  });
});

describe("templates", () => {
  it("quotes user text placed in frontmatter", () => {
    const text = fill(TEMPLATES["feature/feature.md"] as string, {
      id: "F-001",
      title: "Checkout: pay #1",
      summary: "Pay, then ship: fast",
      priority: "P1",
      mode: "brownfield",
      milestone: "null",
      date: "2026-10-18",
    });
    const fm = parseFrontmatter(text);
    expect(fm.errors).toEqual([]);
    expect(fm.data).toMatchObject({
      title: "Checkout: pay #1",
      summary: "Pay, then ship: fast",
      status: "idea",
    });
    expect(text).toContain("# F-001: Checkout: pay #1");
  });
});
