import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { readLiveRecords } from "../../src/core/live";
import { featureFiles } from "../helpers/project";
import { commitAll, gitEnv, initRepo } from "../helpers/git";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

const LAUNCHER = fileURLToPath(new URL("../../plugin/bin/azimuth", import.meta.url));
const SESSION = "claude-session-1";

let tree: ReturnType<typeof writeTree>;
let envFile: string;

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...gitEnv(),
    HOME: process.env.HOME,
    PATH: "/usr/local/bin:/usr/bin:/bin",
    AZIMUTH_NO_VIEWER: "1",
    CLAUDE_PROJECT_DIR: tree.root,
    CLAUDE_ENV_FILE: envFile,
    NO_COLOR: "1",
    ...extra,
  };
}

function hook(event: string, input: Record<string, unknown>, extra: Record<string, string> = {}) {
  const r = spawnSync(LAUNCHER, ["hook", event], {
    cwd: tree.root,
    env: env(extra),
    input: JSON.stringify({ session_id: SESSION, cwd: tree.root, ...input }),
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function az(args: string[], actor: "you" | "agent") {
  return spawnSync(LAUNCHER, args, {
    cwd: tree.root,
    env: env({ AZIMUTH_ACTOR: actor }),
    encoding: "utf8",
  });
}

beforeAll(() => {
  tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({ id: "F-001", status: "in-progress", slug: "checkout" }),
    ".azimuth/questions/Q-0001.md":
      "---\nid: Q-0001\ntitle: Which card network?\nfeature: F-001\nraised_by: you\nraised_at: 2026-10-01T10:00:00Z\noptions:\n  - key: visa\n    label: Visa only\n    recommended: true\n  - key: all\n    label: All networks\n---\n",
    "src/app.ts": "export {};\n",
  });
  envFile = join(mkdtempSync(join(tmpdir(), "azimuth-env-")), "env.sh");
  initRepo(tree.root);
  commitAll(tree.root, "chore: start");
});

afterAll(() => {
  tree.cleanup();
  rmSync(join(envFile, ".."), { recursive: true, force: true });
});

describe("Claude Code hooks", () => {
  it("does nothing outside an Azimuth project, quickly", () => {
    const outside = mkdtempSync(join(tmpdir(), "azimuth-outside-"));
    const started = Date.now();
    const r = spawnSync(LAUNCHER, ["hook", "post-tool-use"], {
      cwd: outside,
      env: { ...env(), CLAUDE_PROJECT_DIR: outside },
      input: "{}",
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
    expect(Date.now() - started).toBeLessThan(500);
    rmSync(outside, { recursive: true, force: true });
  });

  it("starts a session: env exports once, project context, live record", () => {
    const first = hook("session-start", { source: "startup" });
    hook("session-start", { source: "resume" });
    expect(first.code).toBe(0);
    const output = JSON.parse(first.out) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(output.hookSpecificOutput.additionalContext).toContain("managed with Azimuth");
    expect(output.hookSpecificOutput.additionalContext).toContain("F-001 in-progress");
    expect(readFileSync(envFile, "utf8")).toBe(
      `export AZIMUTH_ACTOR=agent\nexport AZIMUTH_CLAUDE_SESSION="${SESSION}"\n`,
    );
    expect(readLiveRecords(tree.root, SESSION).map((r) => r.kind)).toEqual(["start", "start"]);
  });

  it("re-grounds the agent after compaction", () => {
    hook("post-tool-use", {
      tool_name: "Bash",
      tool_input: { command: "azimuth move T-001.1 in-progress" },
    });
    const r = hook("session-start", { source: "compact" });
    const text = (JSON.parse(r.out) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;
    expect(text).toContain("You were working on T-001.1 (F-001)");
    expect(text).toContain("azimuth show F-001 --brief");
  });

  it("records concurrent tool events without tearing lines", async () => {
    const before = readLiveRecords(tree.root, SESSION).filter((r) => r.kind === "tool").length;
    const runs = Array.from(
      { length: 50 },
      (_, i) =>
        new Promise<number>((resolve) => {
          const child = spawn(LAUNCHER, ["hook", "post-tool-use"], { cwd: tree.root, env: env() });
          child.stdin.end(
            JSON.stringify({
              session_id: SESSION,
              cwd: tree.root,
              tool_name: "Read",
              tool_input: { file_path: join(tree.root, `src/f${i}.ts`) },
            }),
          );
          child.on("close", (code) => resolve(code ?? 1));
        }),
    );
    expect((await Promise.all(runs)).every((c) => c === 0)).toBe(true);
    const lines = readFileSync(join(tree.root, ".azimuth/cache/live", `${SESSION}.jsonl`), "utf8")
      .trim()
      .split("\n");
    expect(lines.every((l) => JSON.parse(l))).toBe(true);
    const tools = readLiveRecords(tree.root, SESSION).filter((r) => r.kind === "tool");
    expect(tools.length - before).toBe(50);
    const live = buildIndex(tree.root).index.live[0];
    expect(live?.claude_session).toBe(SESSION);
    expect(live?.current?.summary).toMatch(/^Read src\/f\d+\.ts$/);
  });

  it("wakes the agent when you act on its feature, once", () => {
    expect(
      az(["answer", "Q-0001", "--option", "visa", "--text", "Start with Visa"], "you").status,
    ).toBe(0);
    const woke = hook("post-tool-use", {
      tool_name: "Bash",
      tool_input: { command: "azimuth show F-001 --brief" },
    });
    expect(woke.code).toBe(2);
    expect(woke.err).toContain(
      "answered Q-0001 (Which card network?): Visa only — Start with Visa",
    );
    const again = hook("post-tool-use", { tool_name: "Bash", tool_input: { command: "ls" } });
    expect(again.code).toBe(0);
  });

  it("tells the agent about your actions at the next prompt", () => {
    expect(az(["log", "F-001", "Keep the card form accessible", "--review"], "you").status).toBe(0);
    const r = hook("user-prompt-submit", { prompt: "continue" });
    const text = (JSON.parse(r.out) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;
    expect(text).toContain("requested changes on F-001: Keep the card form accessible");
    expect(hook("user-prompt-submit", { prompt: "next" }).out).toBe("");
  });

  it("blocks an edit that leaves an .azimuth file invalid", () => {
    const file = join(tree.root, ".azimuth/questions/Q-0001.md");
    const valid = readFileSync(file, "utf8");
    expect(hook("check-edit", { tool_name: "Edit", tool_input: { file_path: file } }).out).toBe("");
    writeFileSync(file, valid.replace("raised_at: 2026-10-01T10:00:00Z", "raised_at: yesterday"));
    const blocked = JSON.parse(
      hook("check-edit", { tool_name: "Edit", tool_input: { file_path: file } }).out,
    ) as { decision: string; reason: string };
    expect(blocked.decision).toBe("block");
    expect(blocked.reason).toContain("raised_at must be a timestamp");
    expect(
      hook("check-edit", {
        tool_name: "Write",
        tool_input: { file_path: join(tree.root, "src/app.ts") },
      }).out,
    ).toBe("");

    hook("post-tool-use", { tool_name: "Edit", tool_input: { file_path: file } });
    const stop = JSON.parse(hook("stop", { stop_hook_active: false }).out) as {
      decision: string;
      reason: string;
    };
    expect(stop.decision).toBe("block");
    expect(stop.reason).toContain(".azimuth/questions/Q-0001.md");
    expect(hook("stop", { stop_hook_active: true }).out).toBe("");
    writeFileSync(file, valid);
    expect(hook("stop", { stop_hook_active: false }).out).toBe("");
  });

  it("ends the session quickly", () => {
    const started = Date.now();
    expect(hook("session-end", { reason: "prompt_input_exit" }).code).toBe(0);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(buildIndex(tree.root).index.live[0]?.ended_at).not.toBeNull();
  });
});
