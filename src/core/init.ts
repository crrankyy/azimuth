import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { AzimuthError } from "./errors";
import { inlineYaml } from "./frontmatter";
import { AZ_DIR, CONFIG_FILE } from "./paths";
import { AGENTS_BLOCK, CLAUDE_BLOCK, PROTOCOL } from "./protocol";
import { TEMPLATES } from "./templates";
import type { ProjectMode } from "./types";

export interface Detected {
  name: string;
  mode: ProjectMode;
  languages: string[];
  packageManager: string | null;
  testRunner: string | null;
  commands: Record<string, string>;
  testGlobs: string[];
  usesPrettier: boolean;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasAny(root: string, names: string[]): boolean {
  return names.some((n) => existsSync(join(root, n)));
}

/** Looks at manifests and lockfiles to guess the stack and its commands. */
export function detectStack(root: string): Detected {
  const out: Detected = {
    name: basename(root),
    mode: "greenfield",
    languages: [],
    packageManager: null,
    testRunner: null,
    commands: {},
    testGlobs: [],
    usesPrettier: false,
  };
  const pkg = readJson(join(root, "package.json"));
  if (pkg) {
    out.mode = "brownfield";
    if (typeof pkg.name === "string" && pkg.name) out.name = pkg.name.replace(/^@[^/]+\//, "");
    const deps = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) } as Record<
      string,
      string
    >;
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    const pm = hasAny(root, ["pnpm-lock.yaml"])
      ? "pnpm"
      : hasAny(root, ["yarn.lock"])
        ? "yarn"
        : hasAny(root, ["bun.lockb", "bun.lock"])
          ? "bun"
          : "npm";
    out.packageManager = pm;
    out.languages.push(
      deps.typescript || hasAny(root, ["tsconfig.json"]) ? "typescript" : "javascript",
    );
    out.testRunner = deps.vitest ? "vitest" : deps.jest ? "jest" : deps.mocha ? "mocha" : null;
    const run = (script: string) => (pm === "npm" ? `npm run ${script}` : `${pm} ${script}`);
    for (const script of ["build", "typecheck", "test", "lint", "format"]) {
      if (scripts[script]) out.commands[script] = run(script);
    }
    if (!out.commands.typecheck && out.languages.includes("typescript")) {
      out.commands.typecheck = pm === "npm" ? "npx tsc --noEmit" : `${pm} exec tsc --noEmit`;
    }
    out.testGlobs.push("**/*.test.{ts,tsx,js,jsx,mjs}", "**/*.spec.{ts,tsx,js,jsx,mjs}");
    out.usesPrettier =
      Boolean(deps.prettier) ||
      hasAny(root, [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.js",
        "prettier.config.js",
        ".prettierrc.yaml",
      ]);
  }
  if (hasAny(root, ["pyproject.toml", "setup.py", "requirements.txt"])) {
    out.mode = "brownfield";
    out.languages.push("python");
    const uv = hasAny(root, ["uv.lock"]);
    out.packageManager ??= uv ? "uv" : "pip";
    out.testRunner ??= "pytest";
    out.commands.test ??= uv ? "uv run pytest" : "pytest";
    const pyproject = existsSync(join(root, "pyproject.toml"))
      ? readFileSync(join(root, "pyproject.toml"), "utf8")
      : "";
    if (pyproject.includes("ruff"))
      out.commands.lint ??= uv ? "uv run ruff check ." : "ruff check .";
    out.testGlobs.push("**/test_*.py", "**/*_test.py");
  }
  if (hasAny(root, ["Cargo.toml"])) {
    out.mode = "brownfield";
    out.languages.push("rust");
    out.packageManager ??= "cargo";
    out.commands.build ??= "cargo build";
    out.commands.test ??= "cargo test";
    out.commands.lint ??= "cargo clippy";
    out.testGlobs.push("**/*.rs");
  }
  if (hasAny(root, ["go.mod"])) {
    out.mode = "brownfield";
    out.languages.push("go");
    out.packageManager ??= "go";
    out.commands.build ??= "go build ./...";
    out.commands.test ??= "go test ./...";
    out.commands.lint ??= "go vet ./...";
    out.testGlobs.push("**/*_test.go");
  }
  if (out.mode === "greenfield") {
    const entries = readdirSync(root).filter((n) => !n.startsWith(".") && n !== "README.md");
    if (entries.length > 0) out.mode = "brownfield";
  }
  if (out.testGlobs.length === 0) out.testGlobs.push("**/*.test.*", "**/test_*.*", "**/*_test.*");
  return out;
}

const LANGUAGE_NAMES: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  rust: "Rust",
  go: "Go",
};

export function configYaml(d: Detected): string {
  const commands = Object.entries(d.commands)
    .map(([k, v]) => `  ${k}: ${inlineYaml(v)}`)
    .join("\n");
  return `schema: 1
project:
  name: ${inlineYaml(d.name)}
  description: ""
  mode: ${d.mode} # greenfield: a new project, the docs describe the plan | brownfield: existing code
stack:
  languages: ${inlineYaml(d.languages)}
  package_manager: ${d.packageManager ?? "null"}
  test_runner: ${d.testRunner ?? "null"} # informational, e.g. vitest, pytest, cargo test
  display: ${inlineYaml(d.languages.map((l) => LANGUAGE_NAMES[l] ?? l))}
commands:${commands ? `\n${commands}` : " {}"}
tests:
  globs: ${inlineYaml(d.testGlobs)}
git:
  log_depth: 500
  agent_pattern: Claude # Co-Authored-By text that marks a commit as agent-made
  arch_stale_after_commits: 10
autonomy:
  approve_specs: auto # auto: agents approve specs that pass every gate; manual: only you
  accept_adrs: auto # auto: agents accept their own decisions; manual: only you
  strict: false # true: automatic approval also requires zero warnings
stale_after_days: 5
verify:
  timeout_seconds: 600
  output_tail_lines: 40
viewer:
  port: 4319
  autostart: true # Claude Code sessions start the viewer automatically
  editor_url: null # e.g. "vscode://file/{abs}:{line}"
`;
}

function projectDocs(d: Detected, date: string): Record<string, string> {
  return {
    "project/vision.md": `---\nupdated: ${date}\n---\n# Vision\n\n## Problem\n\n## Users\n\n## Goals\n\n## Non-goals\n\n## Success metrics\n\n## Constraints\n`,
    // The comments show the entry formats, since docs/file-format.md isn't in the target repo.
    "project/architecture.md": `---\nupdated: ${date}\nreconciled_at: null\nmodules: [] # - { name: api, path: src/api, responsibility: Serves the HTTP API, depends_on: [store] }\n---\n# Architecture\n\n## Overview\n\n## Tech stack\n${d.languages.join(", ")}\n\n## Directory layout\n\n## Commands\n${Object.entries(
      d.commands,
    )
      .map(([k, v]) => `- ${k}: \`${v}\``)
      .join("\n")}\n\n## Boundaries & invariants\n\n## Data flow\n`,
    "project/conventions.md": `---\nupdated: ${date}\n---\n# Conventions\n\n## Error handling\n\n## Testing\nStart each test name with the scenario ID it covers.\n\n## Naming\n\n## Logging\n\n## Dependencies\n\n## Commits\nConventional Commits with a \`Refs:\` trailer naming the task or feature.\n`,
    "project/glossary.md": `---\nupdated: ${date}\nterms: [] # - { term: Lease, definition: A time-bounded claim on a job, aliases: [lease_until] }\n---\n# Glossary\n`,
  };
}

function writeIfMissing(path: string, text: string, created: string[], label: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  created.push(label);
}

/** Inserts or replaces a `<!-- azimuth:start -->…<!-- azimuth:end -->` block. */
export function upsertBlock(existing: string | null, block: string): string {
  if (existing === null || existing.trim() === "") return `${block}\n`;
  const pattern = /<!-- azimuth:start -->[\s\S]*?<!-- azimuth:end -->/;
  if (pattern.test(existing)) return existing.replace(pattern, block);
  return `${existing.replace(/\s*$/, "")}\n\n${block}\n`;
}

function ensureLine(path: string, line: string): boolean {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current.split(/\r?\n/).some((l) => l.trim() === line)) return false;
  writeFileSync(path, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`);
  return true;
}

function mergeSettings(path: string): boolean {
  const current = readJson(path) ?? {};
  const env = (current.env ?? {}) as Record<string, string>;
  if (env.AZIMUTH_ACTOR === "agent") return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ ...current, env: { ...env, AZIMUTH_ACTOR: "agent" } }, null, 2) + "\n",
  );
  return true;
}

export interface InitResult {
  detected: Detected;
  created: string[];
  updated: string[];
}

/** Scaffolds `.azimuth/` and wires the agent protocol into the repository. */
export function initProject(
  root: string,
  opts: { refresh?: boolean; now?: Date } = {},
): InitResult {
  const configPath = join(root, AZ_DIR, CONFIG_FILE);
  const exists = existsSync(configPath);
  if (exists && !opts.refresh) {
    throw new AzimuthError(
      "conflict",
      "This project already has .azimuth/. Use `azimuth init --refresh` to update the protocol and templates.",
    );
  }
  if (!exists && opts.refresh)
    throw new AzimuthError("not-found", "No .azimuth/ here yet. Run `azimuth init` first.");
  const date = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const detected = detectStack(root);
  const created: string[] = [];
  const updated: string[] = [];
  const az = (p: string) => join(root, AZ_DIR, p);

  if (!exists) {
    writeIfMissing(configPath, configYaml(detected), created, ".azimuth/config.yaml");
    for (const [p, text] of Object.entries(projectDocs(detected, date)))
      writeIfMissing(az(p), text, created, `.azimuth/${p}`);
  }
  writeFileSync(az("PROTOCOL.md"), PROTOCOL);
  (exists ? updated : created).push(".azimuth/PROTOCOL.md");
  for (const [p, text] of Object.entries(TEMPLATES)) {
    mkdirSync(dirname(az(`templates/${p}`)), { recursive: true });
    writeFileSync(az(`templates/${p}`), text);
  }
  (exists ? updated : created).push(".azimuth/templates/");

  for (const [file, block] of [
    ["CLAUDE.md", CLAUDE_BLOCK],
    ["AGENTS.md", AGENTS_BLOCK],
  ] as const) {
    const path = join(root, file);
    const before = existsSync(path) ? readFileSync(path, "utf8") : null;
    const after = upsertBlock(before, block);
    if (after !== before) {
      writeFileSync(path, after);
      (before === null ? created : updated).push(file);
    }
  }
  if (ensureLine(join(root, ".gitignore"), ".azimuth/cache/")) updated.push(".gitignore");
  if (detected.usesPrettier && ensureLine(join(root, ".prettierignore"), ".azimuth/"))
    updated.push(".prettierignore");
  if (mergeSettings(join(root, ".claude", "settings.json"))) updated.push(".claude/settings.json");
  return { detected, created, updated };
}
