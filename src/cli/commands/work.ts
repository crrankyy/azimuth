import { constants } from "node:os";
import { autostartEnabled, recordSessionAfterInit } from "../../hooks/handlers";
import { ensureViewer } from "../../server/autostart";
import { diskSpace, diskWarning } from "../../core/disk";
import { initProject } from "../../core/init";
import { HOOKS_MISSING, hooksRan } from "../../core/live";
import {
  ACTIVE_CLAUDE_MS,
  appendNote,
  claudeSessionFromEnv,
  closeSession,
  closeStaleSessions,
  startSession,
  writeHandoff,
} from "../../core/session";
import { verifyBatch, verifyTargets, type VerifyProgress } from "../../core/verify";
import { print, printJson, requirePositional, runtime, UsageError } from "../io";
import { reportLines, type ReportMode } from "../verify-report";
import type { Command } from "../types";

export const init: Command = {
  usage: "init [--refresh] [--root <dir>]",
  summary: "Set up .azimuth/ in this repository (or refresh the protocol and templates)",
  options: { refresh: { type: "boolean" }, json: { type: "boolean" } },
  async run({ values }) {
    const root = (values.root as string | undefined) ?? process.cwd();
    const result = initProject(root, { refresh: Boolean(values.refresh) });
    // Inside Claude Code the session's start hook ran before .azimuth/ existed: catch up. (A
    // refresh runs in an existing project, whose start was already recorded.)
    const inSession = !values.refresh && recordSessionAfterInit(root, process.env);
    const url = inSession && autostartEnabled(root, process.env) ? await ensureViewer(root) : null;
    if (values.json) {
      printJson(result);
      return;
    }
    if (result.created.length) print(`Created: ${result.created.join(", ")}`);
    if (result.updated.length) print(`Updated: ${result.updated.join(", ")}`);
    if (!values.refresh) {
      const d = result.detected;
      print(`Detected ${d.mode} project "${d.name}" (${d.languages.join(", ") || "no manifest"}).`);
      print(
        "Next: review .azimuth/config.yaml, then run /azimuth:init in Claude Code to describe the project.",
      );
    }
    if (url) print(`Viewer: ${url}`);
  },
};

export const session: Command = {
  usage:
    'session <start --skill <name> --goal "…" [--touch IDs] | note "<text>" | handoff "<next steps>" [--summary "…"] | close [--stale]> [--id SES-…]',
  summary: "Record a unit of agent work and its handoff",
  options: {
    skill: { type: "string" },
    goal: { type: "string" },
    touch: { type: "string" },
    summary: { type: "string" },
    id: { type: "string" },
    stale: { type: "boolean" },
    json: { type: "boolean" },
  },
  run({ values, positionals }) {
    const action = requirePositional(positionals, 0, "start|note|handoff|close");
    const rt = runtime(values);
    const id = (values.id as string | undefined) ?? rt.session;
    switch (action) {
      case "start": {
        const goal = values.goal as string | undefined;
        if (!goal) throw new UsageError('session start needs --goal "…".');
        const touched = ((values.touch as string | undefined) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const claudeSession = claudeSessionFromEnv(process.env);
        const ses = startSession(rt.root, {
          skill: (values.skill as string | undefined) ?? null,
          goal,
          touched,
          agent: process.env.AZIMUTH_AGENT,
          claudeSession,
        });
        if (rt.json) printJson({ id: ses });
        else print(ses);
        // Every unit of work starts here, so a session without hooks is caught at its first step.
        if (claudeSession && !hooksRan(rt.root, claudeSession, Date.now() - ACTIVE_CLAUDE_MS))
          process.stderr.write(`${HOOKS_MISSING}\n`);
        return;
      }
      case "note": {
        const text = positionals[1];
        if (!text) throw new UsageError('session note needs "<text>".');
        print(`Updated ${appendNote(rt.root, id, text)}`);
        return;
      }
      case "handoff": {
        const text = positionals[1];
        const summary = values.summary as string | undefined;
        if (!text && !summary)
          throw new UsageError('session handoff needs "<next steps>" and/or --summary "…".');
        const file = writeHandoff(rt.root, id, { handoff: text, summary });
        print(`Updated ${file}`);
        return;
      }
      case "close": {
        if (values.stale) {
          const closed = closeStaleSessions(rt.root);
          print(closed.length ? `Closed ${closed.join(", ")}` : "No stale sessions.");
          return;
        }
        print(`Closed ${closeSession(rt.root, id)}`);
        return;
      }
      default:
        throw new UsageError(
          `Unknown session action "${action}". Use start, note, handoff or close.`,
        );
    }
  },
};

/**
 * A detached verify command no longer gets the terminal's Ctrl-C, so SIGINT and SIGTERM abort the
 * batch instead: its command's process group is killed and the verify lock released.
 */
export function abortOnSignals() {
  const controller = new AbortController();
  let received: NodeJS.Signals | null = null;
  const handlers = (["SIGINT", "SIGTERM"] as const).map((name) => {
    const handler = () => {
      received ??= name;
      controller.abort();
    };
    process.on(name, handler);
    return [name, handler] as const;
  });
  return {
    signal: controller.signal,
    received: () => received,
    dispose: () => handlers.forEach(([name, handler]) => process.off(name, handler)),
  };
}

export const verify: Command = {
  usage: "verify [T-ID | F-ID …] [--no-prebuild] [--summary] [--json]",
  summary: "Run verify commands and record the results (default: every in-flight feature)",
  options: {
    "no-prebuild": { type: "boolean" },
    summary: { type: "boolean" },
    json: { type: "boolean" },
  },
  async run({ values, positionals }) {
    const rt = runtime(values);
    const targets = verifyTargets(rt.root, positionals);
    // stderr only, never the exit code: a full disk is worth a warning, not a refusal.
    const warning = targets.length > 0 ? diskWarning(diskSpace(rt.root)) : null;
    if (warning) process.stderr.write(`${warning}\n`);
    const mode: ReportMode = values.summary ? "summary" : "full";
    const onProgress = (event: VerifyProgress) => {
      if (!rt.json) {
        for (const line of reportLines(event, mode)) print(line);
        return;
      }
      // stdout stays JSON; a failed prebuild, which leaves no run to show, goes to stderr.
      if (event.kind === "prebuilt" && !event.result.ok) {
        for (const line of reportLines(event, mode)) process.stderr.write(`${line}\n`);
      }
    };
    const interrupt = abortOnSignals();
    try {
      const result = await verifyBatch(rt.root, targets, {
        prebuild: !values["no-prebuild"],
        ses: rt.session,
        onProgress,
        signal: interrupt.signal,
      });
      if (rt.json) printJson(result.runs);
      const received = interrupt.received();
      if (received) return 128 + constants.signals[received];
      const ok = (result.prebuild?.ok ?? true) && result.runs.every((r) => r.ok);
      return ok ? 0 : 1;
    } finally {
      interrupt.dispose();
    }
  },
};
