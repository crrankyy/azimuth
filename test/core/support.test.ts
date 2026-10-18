import { afterEach, describe, expect, it } from "vitest";
import { detectStack, upsertBlock } from "../../src/core/init";
import { parseJunit, scenariosFromOutput } from "../../src/core/junit";
import { parseFrontmatter } from "../../src/core/frontmatter";
import { AGENTS_BLOCK, CLAUDE_BLOCK } from "../../src/core/protocol";
import { fill, TEMPLATES } from "../../src/core/templates";
import { format } from "prettier";
import { writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

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
});

describe("scenariosFromOutput", () => {
  it("passes every covered scenario on success", () => {
    expect(Object.fromEntries(scenariosFromOutput("all good", true, ["S-001.1.1"]))).toEqual({
      "S-001.1.1": "passing",
    });
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
