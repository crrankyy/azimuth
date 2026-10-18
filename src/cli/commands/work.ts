import { autostartEnabled, recordSessionAfterInit } from "../../hooks/handlers";
import { ensureViewer } from "../../server/autostart";
import { initProject } from "../../core/init";
import {
  claudeSessionFromEnv,
  closeSession,
  closeStaleSessions,
  startSession,
  writeHandoff,
} from "../../core/session";
import { runVerify, verifyTargets } from "../../core/verify";
import { color, print, printJson, requirePositional, runtime, UsageError } from "../io";
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
    'session <start --skill <name> --goal "…" | handoff "<next steps>" [--summary "…"] | close [--stale]> [--id SES-…]',
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
    const action = requirePositional(positionals, 0, "start|handoff|close");
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
        const ses = startSession(rt.root, {
          skill: (values.skill as string | undefined) ?? null,
          goal,
          touched,
          agent: process.env.AZIMUTH_AGENT,
          claudeSession: claudeSessionFromEnv(process.env),
        });
        if (rt.json) printJson({ id: ses });
        else print(ses);
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
        throw new UsageError(`Unknown session action "${action}". Use start, handoff or close.`);
    }
  },
};

export const verify: Command = {
  usage: "verify [T-ID | F-ID] [--json]",
  summary: "Run verify commands and record the results (default: every in-flight feature)",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const rt = runtime(values);
    const targets = verifyTargets(rt.root, positionals[0] ?? null);
    const runs = [];
    for (const target of targets) {
      if (!rt.json) print(color.dim(`${target.task}: ${target.command}`));
      const run = runVerify(rt.root, target);
      runs.push(run);
      if (!rt.json) {
        const verdict = run.ok
          ? color.green("passed")
          : color.red(`failed (exit ${run.exit_code})`);
        print(`${run.id} ${target.task} ${verdict} in ${(run.duration_ms / 1000).toFixed(1)}s`);
        if (!run.ok && run.output_tail)
          print(
            color.dim(
              run.output_tail
                .split("\n")
                .map((l) => `    ${l}`)
                .join("\n"),
            ),
          );
      }
    }
    if (rt.json) printJson(runs);
    return runs.every((r) => r.ok) ? 0 : 1;
  },
};
