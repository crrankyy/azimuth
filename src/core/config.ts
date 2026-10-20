import { readFileSync } from "node:fs";
import { parseDocument, isMap, isScalar } from "yaml";
import { AZ_DIR, CONFIG_FILE, azPath } from "./paths";
import { r, type Reader } from "./schema";
import { QUESTION_AUTONOMY, type Autonomy, type Problem, type ProjectMode } from "./types";

export const PREBUILD_FAILURES = ["stop", "continue"] as const;
export type PrebuildFailure = (typeof PREBUILD_FAILURES)[number];

export interface Config {
  schema: 1;
  project: { name: string; description: string; mode: ProjectMode };
  stack: {
    languages: string[];
    package_manager: string | null;
    test_runner: string | null;
    display: string[];
  };
  commands: Record<string, string>;
  tests: { globs: string[] };
  git: { log_depth: number; agent_pattern: string; arch_stale_after_commits: number };
  autonomy: Autonomy;
  stale_after_days: number;
  verify: {
    timeout_seconds: number;
    output_tail_lines: number;
    /** Globs (globToRegExp) of repo-relative files every verify run depends on. */
    shared_paths: string[];
    /**
     * Globs (globToRegExp) of repo-relative files whose change never makes a verify run stale,
     * even when they are a task's own paths.
     */
    ignore_paths: string[];
    /** Run once per `azimuth verify` call before the targets; null (or blank) = no prebuild. */
    prebuild: string | null;
    /** Timeout of the prebuild alone. */
    build_timeout_seconds: number;
    /**
     * What a prebuild that exits non-zero does. stop (default): no target runs and no run is
     * recorded. continue: every target runs under build_timeout_seconds + timeout_seconds and
     * records prebuild { ok: false }. A prebuild that times out or is interrupted always stops.
     */
    prebuild_failure: PrebuildFailure;
    /**
     * verify and task finish warn on stderr, and doctor shows a `?` line, when the project
     * root's filesystem has less than this many GB (10^9 bytes) free; 0 turns the guard off.
     */
    min_free_gb: number;
  };
  parallel: {
    /**
     * Globs (globToRegExp) of repo-relative files that tasks extend additively, such as an
     * enum, its dispatch or a keymap. They are never file conflicts, and tasks listing them
     * may run at the same time.
     */
    shared_files: string[];
  };
  viewer: { port: number; autostart: boolean; editor_url: string | null };
}

export const DEFAULT_CONFIG: Config = {
  schema: 1,
  project: { name: "", description: "", mode: "brownfield" },
  stack: { languages: [], package_manager: null, test_runner: null, display: [] },
  commands: {},
  tests: { globs: ["**/*.test.*", "**/*_test.*", "**/test_*.py", "tests/**/*"] },
  git: { log_depth: 500, agent_pattern: "Claude", arch_stale_after_commits: 10 },
  autonomy: { approve_specs: "auto", accept_adrs: "auto", questions: "ask", strict: false },
  stale_after_days: 5,
  verify: {
    timeout_seconds: 600,
    output_tail_lines: 40,
    // A glob without "/" or "**" matches the repository root only.
    shared_paths: [
      "package.json",
      "pnpm-lock.yaml",
      "Cargo.toml",
      "Cargo.lock",
      "go.mod",
      "go.sum",
      "pyproject.toml",
      "uv.lock",
    ],
    ignore_paths: [],
    prebuild: null,
    build_timeout_seconds: 1800,
    prebuild_failure: "stop",
    min_free_gb: 10,
  },
  parallel: { shared_files: [] },
  viewer: { port: 4319, autostart: true, editor_url: null },
};

const CONFIG_PATH = `${AZ_DIR}/${CONFIG_FILE}`;

/** Sections and their keys, with a reader per key. */
const SHAPE: Record<string, Record<string, Reader<unknown>> | Reader<unknown>> = {
  schema: r.int(1),
  project: {
    name: r.string(),
    description: r.string(),
    mode: r.oneOf(["greenfield", "brownfield"] as const),
  },
  stack: {
    languages: r.strings(),
    package_manager: r.nullable(r.string()),
    test_runner: r.nullable(r.string()),
    display: r.strings(),
  },
  commands: r.any(),
  tests: { globs: r.strings() },
  git: { log_depth: r.int(1), agent_pattern: r.string(), arch_stale_after_commits: r.int(0) },
  autonomy: {
    approve_specs: r.oneOf(["auto", "manual"] as const),
    accept_adrs: r.oneOf(["auto", "manual"] as const),
    questions: r.oneOf(QUESTION_AUTONOMY),
    strict: r.bool(),
  },
  stale_after_days: r.int(1),
  verify: {
    timeout_seconds: r.int(1),
    output_tail_lines: r.int(1),
    shared_paths: r.strings(),
    ignore_paths: r.strings(),
    prebuild: r.nullable(r.string()),
    build_timeout_seconds: r.int(1),
    prebuild_failure: r.oneOf(PREBUILD_FAILURES),
    min_free_gb: r.int(0),
  },
  parallel: { shared_files: r.strings() },
  viewer: { port: r.int(1), autostart: r.bool(), editor_url: r.nullable(r.string()) },
};

export interface LoadedConfig {
  config: Config;
  problems: Problem[];
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

export function parseConfig(text: string): LoadedConfig {
  const problems: Problem[] = [];
  const doc = parseDocument(text);
  const problem = (
    code: string,
    severity: "error" | "warning",
    line: number | null,
    message: string,
  ) => problems.push({ code, severity, file: CONFIG_PATH, line, ref: null, message });

  for (const e of doc.errors)
    problem("E-PARSE", "error", e.linePos?.[0].line ?? null, e.message.split("\n")[0] ?? e.message);
  if (doc.errors.length > 0 || !isMap(doc.contents)) {
    if (doc.errors.length === 0)
      problem("E-PARSE", "error", 1, "config.yaml must be a YAML mapping.");
    return { config: structuredClone(DEFAULT_CONFIG), problems };
  }

  const config = structuredClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  const lineOf = (node: unknown) =>
    isScalar(node) && node.range ? lineAt(text, node.range[0]) : null;

  for (const pair of doc.contents.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "";
    const shape = SHAPE[key];
    const line = lineOf(pair.key);
    if (!shape) {
      problem("W-UNKNOWN-KEY", "warning", line, `Unknown key "${key}".`);
      continue;
    }
    const value = (pair.value as { toJSON?: () => unknown } | null)?.toJSON?.() ?? null;
    if (typeof shape === "function") {
      const result = shape(value);
      if (result.ok) config[key] = key === "commands" ? stringRecord(result.value) : result.value;
      else problem("E-SCHEMA", "error", line, `${key} must be ${result.expected}.`);
      continue;
    }
    if (!isMap(pair.value)) {
      problem("E-SCHEMA", "error", line, `${key} must be a mapping.`);
      continue;
    }
    const section = config[key] as Record<string, unknown>;
    for (const inner of pair.value.items) {
      const innerKey = isScalar(inner.key) ? String(inner.key.value) : "";
      const reader = shape[innerKey];
      const innerLine = lineOf(inner.key);
      if (!reader) {
        problem("W-UNKNOWN-KEY", "warning", innerLine, `Unknown key "${key}.${innerKey}".`);
        continue;
      }
      const innerValue = (inner.value as { toJSON?: () => unknown } | null)?.toJSON?.() ?? null;
      const result = reader(innerValue);
      if (result.ok) section[innerKey] = result.value;
      else
        problem("E-SCHEMA", "error", innerLine, `${key}.${innerKey} must be ${result.expected}.`);
    }
  }

  const parsed = config as unknown as Config;
  if (!parsed.project.name) problem("E-SCHEMA", "error", 1, "project.name is required.");
  if (parsed.stack.display.length === 0) parsed.stack.display = [...parsed.stack.languages];
  return { config: parsed, problems };
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => [k, v as string]),
  );
}

export function loadConfig(root: string): LoadedConfig {
  let text: string;
  try {
    text = readFileSync(azPath(root, CONFIG_FILE), "utf8");
  } catch {
    return {
      config: structuredClone(DEFAULT_CONFIG),
      problems: [
        {
          code: "E-PARSE",
          severity: "error",
          file: CONFIG_PATH,
          line: null,
          ref: null,
          message: "config.yaml is missing.",
        },
      ],
    };
  }
  return parseConfig(text);
}
