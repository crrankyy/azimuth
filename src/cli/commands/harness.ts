import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../../core/build-index";
import { sharedCacheDir } from "../../core/lock";
import { readLiveSessions } from "../../core/live";
import { findProjectRoot } from "../../core/paths";
import { VERSION } from "../../core/version";
import { HOOKS, type HookInput } from "../../hooks/handlers";
import { ensureViewer } from "../../server/autostart";
import { viewerUrl } from "../../server/registry";
import type { Index } from "../../core/types";
import { color, print, requirePositional, UsageError } from "../io";
import type { Command } from "../types";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** Adds export lines to Claude Code's per-session env file, once each. */
function writeEnvFile(path: string | undefined, lines: string[]): void {
  if (!path) return;
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const missing = lines.filter((line) => !current.split("\n").includes(line));
  if (missing.length)
    appendFileSync(
      path,
      `${current && !current.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`,
    );
}

function logHookError(event: string, input: HookInput, error: unknown): void {
  try {
    const root = findProjectRoot(process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd());
    if (!root) return;
    const dir = sharedCacheDir(root);
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, "hooks.log"),
      `${new Date().toISOString()} ${event}: ${(error as Error).stack ?? String(error)}\n`,
    );
  } catch {
    // Logging must never be the reason a hook fails.
  }
}

export const hook: Command = {
  usage:
    "hook <session-start|pre-tool-use|post-tool-use|check-edit|user-prompt-submit|stop|subagent-start|subagent-stop|session-end>",
  summary: "(internal) Claude Code hook entry point; reads the hook JSON on stdin",
  async run({ positionals }) {
    const event = requirePositional(positionals, 0, "event");
    const handler = HOOKS[event];
    if (!handler) throw new UsageError(`Unknown hook "${event}".`);
    let input: HookInput = {};
    try {
      input = JSON.parse(readStdin() || "{}") as HookInput;
    } catch {
      return 0;
    }
    try {
      const out = await handler(input, {
        env: process.env,
        ensureViewer: (root, waitMs) => ensureViewer(root, waitMs),
        pluginDir: pluginDir(),
        writeEnv: (lines) => writeEnvFile(process.env.CLAUDE_ENV_FILE, lines),
      });
      if (out.stdout) process.stdout.write(out.stdout);
      if (out.stderr) process.stderr.write(out.stderr);
      return out.exitCode;
    } catch (error) {
      // A broken hook must never block the user's session.
      logHookError(event, input, error);
      return 0;
    }
  },
};

/** The plugin folder this CLI runs from (dist/cli.mjs → plugin/). */
function pluginDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

interface PluginEntry {
  id?: string;
  scope?: string;
  enabled?: boolean;
  projectPath?: string;
}

/** What `claude plugin list --json`, run in the project, says about the Azimuth plugin. */
export function pluginCheck(listJson: string): { ok: boolean | null; text: string } {
  let entries: PluginEntry[];
  try {
    entries = JSON.parse(listJson) as PluginEntry[];
  } catch {
    return { ok: null, text: "Could not read `claude plugin list --json`" };
  }
  const ours = entries.filter((p) => p.id?.startsWith("azimuth@"));
  const enabled = ours.find((p) => p.enabled);
  if (enabled) {
    return {
      ok: true,
      text: `Claude Code plugin ${enabled.id} is enabled here (${enabled.scope} scope)`,
    };
  }
  if (ours.length > 0) {
    const where = ours
      .map((p) => (p.projectPath ? `${p.scope} scope in ${p.projectPath}` : `${p.scope} scope`))
      .join(", ");
    return {
      ok: false,
      text: `Claude Code plugin is installed (${where}) but not enabled for this project, so no hooks run here. Install it for all your projects (claude plugin install azimuth@azimuth) or for this one (--scope local).`,
    };
  }
  return {
    ok: false,
    text: "Claude Code plugin is not installed (claude plugin install azimuth@azimuth)",
  };
}

export const doctor: Command = {
  usage: "doctor [--print-path]",
  summary: "Check that Node, the plugin, hooks and the viewer are wired up",
  options: { "print-path": { type: "boolean" } },
  run({ values }) {
    const launcher = join(pluginDir(), "bin", "azimuth");
    if (values["print-path"]) {
      print(
        `# Make \`azimuth\` available in your terminal:\nln -sf "${launcher}" "$HOME/.local/bin/azimuth"`,
      );
      return 0;
    }
    let failed = 0;
    const line = (ok: boolean | null, text: string) => {
      if (ok === false) failed++;
      print(`${ok === null ? color.yellow("?") : ok ? color.green("✓") : color.red("✗")} ${text}`);
    };
    line(true, `azimuth ${VERSION} on Node ${process.versions.node} (${process.execPath})`);
    const root = findProjectRoot(values.root ?? process.cwd());
    // Run from the project: `enabled` reflects the settings that apply in that folder.
    const plugins = spawnSync("claude", ["plugin", "list", "--json"], {
      encoding: "utf8",
      cwd: root ?? process.cwd(),
    });
    if (plugins.status === 0) {
      const check = pluginCheck(plugins.stdout);
      line(check.ok, check.text);
    } else {
      line(null, "Could not run `claude plugin list` to check the plugin");
    }
    if (!root) {
      line(null, "No .azimuth/ here (run `azimuth init` in a repository)");
      return failed ? 1 : 0;
    }
    line(true, `Project at ${root}`);
    const { problems } = buildIndex(root);
    const errors = problems.filter((p) => p.severity === "error").length;
    line(
      errors === 0,
      errors === 0 ? "No validation errors" : `${errors} validation errors (azimuth check)`,
    );
    const claudeMd = existsSync(join(root, "CLAUDE.md"))
      ? readFileSync(join(root, "CLAUDE.md"), "utf8")
      : "";
    line(claudeMd.includes("@.azimuth/PROTOCOL.md"), "CLAUDE.md imports the Azimuth protocol");
    const live = readLiveSessions(root);
    line(
      live.length > 0 ? true : null,
      live.length > 0
        ? `Hooks are recording (last activity ${live[0]?.last_seen_at})`
        : "No hook activity yet (start a Claude Code session here)",
    );
    const url = viewerUrl(root);
    line(url ? true : null, url ? `Viewer running at ${url}` : "Viewer not running (azimuth view)");
    const hookLog = join(sharedCacheDir(root), "hooks.log");
    if (existsSync(hookLog) && Date.now() - statSync(hookLog).mtimeMs < 86_400_000) {
      line(false, `Hooks reported errors in the last day: see ${hookLog}`);
    }
    return failed ? 1 : 0;
  },
};

/** Index from cache when fresh, so frequent status-line refreshes stay cheap. */
function cachedIndex(root: string): Index {
  const path = join(sharedCacheDir(root), "index.json");
  try {
    if (Date.now() - statSync(path).mtimeMs < 15_000)
      return JSON.parse(readFileSync(path, "utf8")) as Index;
  } catch {
    // No cache yet.
  }
  const { index } = buildIndex(root);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(index));
  } catch {
    // Read-only checkout; the status line still works.
  }
  return index;
}

export const statusline: Command = {
  usage: "statusline",
  summary: "One-line project status for Claude Code's status line (reads its JSON on stdin)",
  run() {
    let cwd = process.cwd();
    try {
      const input = JSON.parse(readStdin() || "{}") as {
        workspace?: { current_dir?: string };
        cwd?: string;
      };
      cwd = input.workspace?.current_dir ?? input.cwd ?? cwd;
    } catch {
      // Not JSON: fall back to the working directory.
    }
    const root = findProjectRoot(cwd);
    if (!root) return 0;
    const index = cachedIndex(root);
    const active =
      index.features.find((f) => f.status === "in-progress") ??
      index.features.find((f) => f.status === "verifying");
    const task = active?.detail?.tasks.find((t) => t.status === "in-progress");
    const needs = index.inbox.filter((i) => i.urgency !== "low").length;
    const parts = [
      active ? `${active.id} ${active.status}` : null,
      task ? `${task.id} in progress` : null,
      needs ? `${needs} need you` : null,
    ].filter(Boolean);
    print(`◎ ${parts.length ? parts.join(" · ") : index.project.name}`);
    return 0;
  },
};
