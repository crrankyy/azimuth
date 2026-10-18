import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TestRef } from "./facts";
import { globToRegExp, matchesAny } from "./glob";

const SCENARIO = String.raw`S-\d{3}\.\d+\.\d+`;
/** `it("S-005.1.2 …")`, `test('S-…')`, `describe(\`S-…\`)` and their `.only`/`.skip` forms. */
const JS_TITLE = new RegExp(
  String.raw`\b(?:it|test|describe)(?:\.\w+)*\(\s*(["'\`])((${SCENARIO})\b[^"'\`]*)\1`,
  "g",
);
/** `@pytest.mark.scenario("S-…")`. */
const PY_MARK = new RegExp(String.raw`@pytest\.mark\.scenario\(\s*["'](${SCENARIO})["']\s*\)`, "g");
/** `// scenario: S-…` or `# scenario: S-…` above a test. */
const COMMENT = new RegExp(String.raw`(?:\/\/|#)\s*scenario:\s*(${SCENARIO})`, "g");
const ANY = new RegExp(SCENARIO, "g");

const SKIP_DIRS = new Set([
  ".git",
  ".azimuth",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "target",
  ".venv",
  "venv",
  "vendor",
]);

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** Name of the test that follows a marker line (Python `def`, Rust/Go `fn`/`func`, or the line itself). */
function followingTestName(lines: string[], fromLine: number): string {
  for (let i = fromLine; i < Math.min(lines.length, fromLine + 6); i++) {
    const line = (lines[i] ?? "").trim();
    const fn = /\b(?:def|fn|func)\s+([A-Za-z_]\w*)/.exec(line);
    if (fn?.[1]) return fn[1];
  }
  return (lines[fromLine] ?? "").trim().slice(0, 80);
}

/** Finds scenario references in one test file. */
export function scanTestFile(text: string, file: string): Map<string, TestRef[]> {
  const out = new Map<string, TestRef[]>();
  const covered = new Set<number>();
  const add = (id: string, ref: TestRef) => out.set(id, [...(out.get(id) ?? []), ref]);
  const lines = text.split("\n");

  for (const m of text.matchAll(JS_TITLE)) {
    add(m[3] as string, { file, name: (m[2] as string).trim(), confidence: "marker" });
    covered.add(lineAt(text, m.index ?? 0));
  }
  for (const pattern of [PY_MARK, COMMENT]) {
    for (const m of text.matchAll(pattern)) {
      const line = lineAt(text, m.index ?? 0);
      add(m[1] as string, { file, name: followingTestName(lines, line), confidence: "marker" });
      covered.add(line);
    }
  }
  for (const m of text.matchAll(ANY)) {
    const line = lineAt(text, m.index ?? 0);
    if (covered.has(line)) continue;
    add(m[0], { file, name: (lines[line - 1] ?? "").trim().slice(0, 80), confidence: "fallback" });
    covered.add(line);
  }
  return out;
}

function listFiles(root: string): string[] {
  const viaGit = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  if (viaGit.status === 0) return viaGit.stdout.split("\0").filter(Boolean);
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs, rel);
      else out.push(rel);
    }
  };
  walk(root, "");
  return out;
}

interface CachedScan {
  mtimeMs: number;
  size: number;
  refs: Map<string, TestRef[]>;
}
const scanCache = new Map<string, CachedScan>();

/**
 * Scenario ID → tests referencing it, across every file matching `globs`. A glob starting with `!`
 * excludes files, e.g. sample projects kept as test fixtures.
 */
export function traceTests(root: string, globs: string[]): Map<string, TestRef[]> {
  const include = globs.filter((g) => !g.startsWith("!")).map(globToRegExp);
  const exclude = globs.filter((g) => g.startsWith("!")).map((g) => globToRegExp(g.slice(1)));
  const out = new Map<string, TestRef[]>();
  for (const file of listFiles(root)) {
    if (!matchesAny(file, include) || matchesAny(file, exclude)) continue;
    const abs = join(root, file);
    let refs: Map<string, TestRef[]>;
    try {
      const st = statSync(abs);
      const hit = scanCache.get(abs);
      if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
        refs = hit.refs;
      } else {
        refs = scanTestFile(readFileSync(abs, "utf8"), file);
        scanCache.set(abs, { mtimeMs: st.mtimeMs, size: st.size, refs });
      }
    } catch {
      continue;
    }
    for (const [id, list] of refs) out.set(id, [...(out.get(id) ?? []), ...list]);
  }
  return out;
}
