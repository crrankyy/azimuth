import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { appendLive, readLiveMeta, readLiveRecords, updateLiveMeta } from "../../src/core/live";
import { parseSession } from "../../src/core/parse/records";
import { closeSession, startSession } from "../../src/core/session";
import {
  describeTool,
  recordSessionAfterInit,
  sessionEnd,
  sessionStart,
  userPromptSubmit,
  type HookEnv,
} from "../../src/hooks/handlers";
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

  it("S-011.4.4 closes the Azimuth session within the SessionEnd budget", () => {
    const start = spawnSync(LAUNCHER, ["session", "start", "--goal", "Build F-001"], {
      cwd: tree.root,
      env: env({ AZIMUTH_ACTOR: "agent", CLAUDE_CODE_SESSION_ID: SESSION }),
      encoding: "utf8",
    });
    expect(start.status).toBe(0);
    const id = start.stdout.trim();
    const file = `.azimuth/sessions/${id}.md`;
    const endedAt = () =>
      parseSession(readFileSync(join(tree.root, file), "utf8"), file).entity?.ended_at;
    expect(endedAt()).toBeNull();
    const started = Date.now();
    expect(hook("session-end", { reason: "prompt_input_exit" }).code).toBe(0);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(endedAt()).not.toBeNull();
  });
});

describe("viewer autostart at session start", () => {
  const start = async (config: string) => {
    const project = writeTree({ ".azimuth/config.yaml": config });
    const started: string[] = [];
    try {
      await sessionStart(
        { session_id: "autostart-check", source: "startup", cwd: project.root },
        {
          env: { CLAUDE_PROJECT_DIR: project.root },
          ensureViewer: async (root) => {
            started.push(root);
            return null;
          },
          writeEnv: () => undefined,
        },
      );
    } finally {
      project.cleanup();
    }
    return started.length;
  };

  it("starts the viewer by default and not when viewer.autostart is false", async () => {
    expect(await start(MINIMAL_CONFIG)).toBe(1);
    expect(await start(`${MINIMAL_CONFIG}viewer:\n  autostart: false\n`)).toBe(0);
  });
});

describe("Claude Code's process ID", () => {
  const records = async (hook: "start" | "prompt", env: HookEnv) => {
    const project = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    try {
      const input = { session_id: "pid-check", source: "startup", cwd: project.root };
      const ctx = {
        env: { CLAUDE_PROJECT_DIR: project.root, AZIMUTH_NO_VIEWER: "1", ...env },
        writeEnv: () => undefined,
      };
      if (hook === "start") await sessionStart(input, ctx);
      else await userPromptSubmit(input, ctx);
      return readLiveRecords(project.root, "pid-check");
    } finally {
      project.cleanup();
    }
  };

  it("S-001.2.1 is recorded when the session starts", async () => {
    const [start] = await records("start", { CLAUDE_PID: "4242" });
    expect(start).toMatchObject({ kind: "start", pid: 4242 });
  });

  it("S-001.2.2 is recorded with each prompt", async () => {
    const prompt = (await records("prompt", { CLAUDE_PID: "4242" })).find(
      (r) => r.kind === "prompt",
    );
    expect(prompt).toMatchObject({ pid: 4242 });
  });

  it("S-001.2.3 is left out when there is no usable one", async () => {
    for (const env of [{}, { CLAUDE_PID: "abc" }]) {
      const [start] = await records("start", env);
      expect(start).toMatchObject({ kind: "start" });
      expect(start).not.toHaveProperty("pid");
    }
  });
});

describe("viewer restart at each prompt", () => {
  const waits = async (config: string, env: HookEnv = {}) => {
    const project = writeTree({ ".azimuth/config.yaml": config });
    const asked: (number | undefined)[] = [];
    try {
      await userPromptSubmit(
        { session_id: "prompt-check", cwd: project.root },
        {
          env: { CLAUDE_PROJECT_DIR: project.root, ...env },
          ensureViewer: async (_root, waitMs) => {
            asked.push(waitMs);
            return null;
          },
        },
      );
    } finally {
      project.cleanup();
    }
    return asked;
  };

  it("S-001.3.1 asks for the viewer without waiting for it", async () => {
    expect(await waits(MINIMAL_CONFIG)).toEqual([0]);
  });

  it("S-001.3.2 leaves the viewer alone when autostart is off", async () => {
    expect(await waits(`${MINIMAL_CONFIG}viewer:\n  autostart: false\n`)).toEqual([]);
    expect(await waits(MINIMAL_CONFIG, { AZIMUTH_NO_VIEWER: "1" })).toEqual([]);
  });
});

describe("live step summaries", () => {
  const places = { home: "/home/dev", plugin: "/home/dev/clones/azimuth/plugin" };
  const root = "/home/dev/work/tally";

  it("BUG-0023 shows paths relative to the project and hides this machine's folders", () => {
    expect(
      describeTool(
        root,
        "Bash",
        {
          command:
            "cat /home/dev/clones/azimuth/plugin/skills/spec/SKILL.md /home/dev/work/tally/src/a.ts",
        },
        places,
      ).summary,
    ).toBe("cat <plugin>/skills/spec/SKILL.md src/a.ts");
    expect(describeTool(root, "Read", { file_path: "/home/dev/notes.md" }, places)).toEqual({
      file: "~/notes.md",
      summary: "Read ~/notes.md",
    });
    expect(
      describeTool(root, "Edit", { file_path: "/home/dev/work/tally/src/a.ts" }, places).file,
    ).toBe("src/a.ts");
  });
});

describe("a session that runs azimuth init", () => {
  it("BUG-0022 is recorded once .azimuth/ exists, with Claude Code's process ID", () => {
    const project = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    try {
      const env = { CLAUDE_CODE_SESSION_ID: "init-session", CLAUDE_PID: "4242" };
      expect(recordSessionAfterInit(project.root, env)).toBe(true);
      expect(readLiveRecords(project.root, "init-session")).toMatchObject([
        { kind: "start", source: "init", pid: 4242 },
      ]);
      expect(recordSessionAfterInit(project.root, {})).toBe(false);
    } finally {
      project.cleanup();
    }
  });
});

describe("decisions you make between sessions", () => {
  const answered =
    "---\nid: Q-0001\ntitle: Which card network?\nstatus: answered\nfeature: F-001\nblocking: true\nraised_by: you\nraised_at: 2026-10-18T09:00:00Z\noptions:\n  - key: visa\n    label: Visa only\n    recommended: true\n  - key: all\n    label: All networks\nanswer: {option: visa, text: Start with Visa, answered_at: 2026-10-18T10:30:00Z}\n---\n";
  const at = (time: string) => new Date(`2026-10-18T${time}Z`);

  it("BUG-0012 reach a resumed session in its start context and at its first prompt", async () => {
    const project = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({ id: "F-001", status: "draft" }),
      ".azimuth/questions/Q-0001.md": answered,
    });
    try {
      const env = { CLAUDE_PROJECT_DIR: project.root, AZIMUTH_NO_VIEWER: "1" };
      // The session ran 10:00–10:10; you answered at 10:30; it resumes at 11:00.
      appendLive(project.root, "resumed", {
        kind: "start",
        at: "2026-10-18T10:00:00Z",
        source: "startup",
      });
      appendLive(project.root, "resumed", { kind: "prompt", at: "2026-10-18T10:00:05Z" });
      appendLive(project.root, "resumed", { kind: "end", at: "2026-10-18T10:10:00Z" });
      const input = { session_id: "resumed", source: "resume", cwd: project.root };
      const started = await sessionStart(input, {
        env,
        now: at("11:00:00"),
        writeEnv: () => undefined,
      });
      expect(started.stdout).toContain("Q-0001");
      expect(started.stdout).toContain("Visa only");
      const prompt = await userPromptSubmit(input, { env, now: at("11:00:05") });
      const text = (
        JSON.parse(prompt.stdout ?? "{}") as { hookSpecificOutput?: { additionalContext?: string } }
      ).hookSpecificOutput?.additionalContext;
      expect(text).toContain("The user answered Q-0001 (Which card network?): Visa only");
    } finally {
      project.cleanup();
    }
  });
});

describe("F-005 subagent records", () => {
  const last = (session: string) => readLiveRecords(tree.root, session).at(-1);

  it("S-005.1.1 records a launch with the task its description names", () => {
    const r = hook("pre-tool-use", {
      session_id: "f005-launch",
      tool_name: "Agent",
      tool_use_id: "toolu_1",
      tool_input: {
        description: "Build T-002.2 heading recognizer",
        prompt: "Write the tests for S-002.1.1",
      },
    });
    expect(r).toMatchObject({ code: 0, out: "" });
    expect(last("f005-launch")).toMatchObject({
      kind: "launch",
      tool_use_id: "toolu_1",
      description: "Build T-002.2 heading recognizer",
      refs: ["T-002.2"],
    });
  });

  it("S-005.1.2 takes the prompt's IDs when the description names none", () => {
    hook("pre-tool-use", {
      session_id: "f005-prompt",
      tool_name: "Agent",
      tool_use_id: "toolu_2",
      tool_input: { description: "Heading recognizer", prompt: "Build T-002.2 for F-002" },
    });
    expect(last("f005-prompt")).toMatchObject({ kind: "launch", refs: ["T-002.2", "F-002"] });
  });

  it("S-005.1.3 records a starting subagent", () => {
    hook("subagent-start", {
      session_id: "f005-start",
      agent_id: "a1",
      agent_type: "general-purpose",
    });
    expect(last("f005-start")).toMatchObject({
      kind: "subagent",
      agent_id: "a1",
      agent_type: "general-purpose",
    });
  });

  it("S-005.1.4 records a finishing subagent", () => {
    hook("subagent-stop", { session_id: "f005-stop", agent_id: "a1" });
    expect(last("f005-stop")).toMatchObject({ kind: "subagent-stop", agent_id: "a1" });
  });

  it("S-005.1.5 keeps the subagent the Agent tool started on its tool record", () => {
    hook("post-tool-use", {
      session_id: "f005-spawned",
      tool_name: "Agent",
      tool_use_id: "toolu_1",
      tool_input: { description: "Build T-002.2 heading recognizer" },
      tool_response: { isAsync: true, status: "async_launched", agentId: "a1" },
    });
    expect(last("f005-spawned")).toMatchObject({
      kind: "tool",
      tool: "Agent",
      tool_use_id: "toolu_1",
      spawned: "a1",
    });
  });

  it("S-005.1.6 records nothing for other tools or outside an Azimuth project", () => {
    const bash = hook("pre-tool-use", {
      session_id: "f005-none",
      tool_name: "Bash",
      tool_use_id: "toolu_3",
      tool_input: { command: "ls" },
    });
    expect(bash).toMatchObject({ code: 0, out: "" });
    expect(readLiveRecords(tree.root, "f005-none")).toEqual([]);
    const outside = mkdtempSync(join(tmpdir(), "azimuth-outside-"));
    const r = spawnSync(LAUNCHER, ["hook", "subagent-start"], {
      cwd: outside,
      env: { ...env(), CLAUDE_PROJECT_DIR: outside },
      input: JSON.stringify({ session_id: "f005-none", agent_id: "a1" }),
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
    expect(readLiveRecords(outside, "f005-none")).toEqual([]);
    rmSync(outside, { recursive: true, force: true });
  });
});

describe("F-005 wake-ups", () => {
  function project() {
    const p = writeTree({
      ".azimuth/config.yaml": MINIMAL_CONFIG,
      ...featureFiles({ id: "F-002", status: "in-progress", slug: "blocks" }),
      ...featureFiles({ id: "F-003", status: "in-progress", slug: "spans" }),
      ...featureFiles({ id: "F-004", status: "in-progress", slug: "search" }),
      "src/app.ts": "export {};\n",
    });
    initRepo(p.root);
    commitAll(p.root, "chore: start");
    const run = (args: string[], input: Record<string, unknown>, extra = {}) =>
      spawnSync(LAUNCHER, args, {
        cwd: p.root,
        env: env({ CLAUDE_PROJECT_DIR: p.root, ...extra }),
        input: JSON.stringify({ session_id: "f005-wake", cwd: p.root, ...input }),
        encoding: "utf8",
      });
    // The orchestrator works on F-003 while a subagent builds T-002.2.
    run(["hook", "session-start"], { source: "startup" });
    run(["hook", "post-tool-use"], {
      tool_name: "Bash",
      tool_input: { command: "azimuth move T-003.4 in-progress" },
    });
    run(["hook", "pre-tool-use"], {
      tool_name: "Agent",
      tool_use_id: "toolu_1",
      tool_input: { description: "Build T-002.2 heading recognizer", prompt: "…" },
    });
    run(["hook", "subagent-start"], { agent_id: "a1", agent_type: "general-purpose" });
    const review = (feature: string) =>
      run(["log", feature, "Keep ATX headings only", "--review"], {}, { AZIMUTH_ACTOR: "you" });
    const step = () =>
      run(["hook", "post-tool-use"], { tool_name: "Bash", tool_input: { command: "ls" } });
    return { ...p, review, step };
  }

  it("S-005.4.1 wakes the orchestrator for a feature its subagent is building", () => {
    const p = project();
    try {
      expect(p.review("F-002").status).toBe(0);
      const woke = p.step();
      expect(woke.status).toBe(2);
      expect(woke.stderr).toContain("F-002");
    } finally {
      p.cleanup();
    }
  });

  it("S-005.4.2 stays quiet for a feature nobody is working on", () => {
    const p = project();
    try {
      expect(p.review("F-004").status).toBe(0);
      const r = p.step();
      expect(r.status).toBe(0);
      expect(r.stdout).toBe("");
    } finally {
      p.cleanup();
    }
  });
});

describe("F-011 the sidecar and the Azimuth session at Claude Code's start and end", () => {
  const at = (time: string) => new Date(`2026-10-20T${time}Z`);
  let project: ReturnType<typeof writeTree> | null = null;
  afterEach(() => project?.cleanup());

  function root(): string {
    project = writeTree({ ".azimuth/config.yaml": MINIMAL_CONFIG });
    return project.root;
  }
  const ctx = (dir: string, time: string) => ({
    env: { CLAUDE_PROJECT_DIR: dir, AZIMUTH_NO_VIEWER: "1" },
    now: at(time),
    writeEnv: () => undefined,
  });
  const start = (dir: string, claude: string, time: string, extra: Record<string, string> = {}) =>
    sessionStart({ session_id: claude, cwd: dir, ...extra }, ctx(dir, time));
  const end = (dir: string, claude: string, time: string) =>
    sessionEnd({ session_id: claude, cwd: dir, reason: "prompt_input_exit" }, ctx(dir, time));
  const read = (dir: string, id: string) => {
    const file = `.azimuth/sessions/${id}.md`;
    return parseSession(readFileSync(join(dir, file), "utf8"), file).entity;
  };

  it("S-011.4.1 closes the open session and collects its commits", () => {
    const dir = root();
    initRepo(dir);
    const id = startSession(dir, {
      skill: "build",
      goal: "Build F-011",
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    const sha = commitAll(dir, "feat: close sessions\n\nRefs: T-011.1", "2026-10-20T09:30:00Z");
    expect(end(dir, "c1", "10:00:00")).toEqual({ exitCode: 0 });
    expect(readLiveRecords(dir, "c1").at(-1)).toEqual({
      kind: "end",
      at: "2026-10-20T10:00:00Z",
      reason: "prompt_input_exit",
    });
    const session = read(dir, id);
    expect(session?.ended_at).toBe("2026-10-20T10:00:00Z");
    expect(session?.commits).toEqual([sha]);
    expect(session?.touched).toContain("T-011.1");
  });

  it("S-011.4.2 leaves a session already closed alone", () => {
    const dir = root();
    const id = startSession(dir, {
      skill: "build",
      goal: "Build F-011",
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    closeSession(dir, id, at("09:45:00"));
    end(dir, "c1", "10:00:00");
    expect(read(dir, id)?.ended_at).toBe("2026-10-20T09:45:00Z");
  });

  it("S-011.4.3 only records the end of a Claude Code session without an Azimuth session", () => {
    const dir = root();
    const id = startSession(dir, {
      skill: "build",
      goal: "Build F-011",
      now: at("09:00:00"),
      claudeSession: "c1",
    });
    appendLive(dir, "c3", { kind: "start", at: "2026-10-20T09:10:00Z", source: "startup" });
    expect(end(dir, "c3", "10:00:00")).toEqual({ exitCode: 0 });
    expect(readLiveRecords(dir, "c3").at(-1)).toMatchObject({ kind: "end" });
    expect(read(dir, id)?.ended_at).toBeNull();
  });

  it("S-011.7.1 sets the start time at the first start and the transcript at each", async () => {
    const dir = root();
    await start(dir, "c4", "09:00:00", { source: "startup", transcript_path: "/tmp/c4.jsonl" });
    await start(dir, "c4", "11:00:00", { source: "compact", transcript_path: "/tmp/c4-b.jsonl" });
    expect(readLiveMeta(dir, "c4")).toEqual({
      started_at: "2026-10-20T09:00:00Z",
      ses: null,
      transcript_path: "/tmp/c4-b.jsonl",
    });
  });

  it("S-011.7.2 keeps the known transcript when a start has none", async () => {
    const dir = root();
    await start(dir, "c4", "09:00:00", { source: "startup", transcript_path: "/tmp/c4.jsonl" });
    await start(dir, "c4", "10:00:00", { source: "resume" });
    expect(readLiveMeta(dir, "c4")?.transcript_path).toBe("/tmp/c4.jsonl");
  });

  it("S-011.7.3 names the session from the sidecar in the compaction note", async () => {
    const dir = root();
    appendLive(dir, "c4", { kind: "start", at: "2026-10-20T09:00:00Z", source: "startup" });
    updateLiveMeta(dir, "c4", { ses: "SES-20261020-0900" });
    const r = await start(dir, "c4", "11:00:00", { source: "compact" });
    const text = (
      JSON.parse(r.stdout ?? "{}") as { hookSpecificOutput: { additionalContext: string } }
    ).hookSpecificOutput.additionalContext;
    expect(text.split("\n")).toContain("- You are in Azimuth session SES-20261020-0900.");
  });
});
