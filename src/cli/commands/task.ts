import { constants } from "node:os";
import { finishTask, type FinishResult } from "../../core/finish";
import { featureOf, idKind } from "../../core/ids";
import { loadProject } from "../../core/model";
import { recordInSession } from "../../core/session";
import { taskBrief } from "../../core/task-brief";
import { color, print, printJson, requirePositional, runtime, UsageError } from "../io";
import type { Command } from "../types";
import { abortOnSignals } from "./work";

function requireTaskId(positionals: string[], index: number): string {
  const id = requirePositional(positionals, index, "T-ID");
  if (idKind(id) !== "task") throw new UsageError(`${id} is not a task ID.`);
  return id;
}

/** One line per step, its output indented below it, and the paths left out after the stage step. */
function finishLines(result: FinishResult): string[] {
  const lines: string[] = [];
  for (const s of result.steps) {
    if (s.status === "not-run") lines.push(color.dim(`- ${s.step}: not run`));
    else {
      const mark = s.status === "done" ? color.green("✓") : color.red("✗");
      lines.push(`${mark} ${s.step}: ${s.detail}`);
      if (s.output) lines.push(...s.output.split("\n").map((line) => color.dim(`    ${line}`)));
    }
    if (s.step === "stage" && result.not_staged.length > 0) {
      lines.push(`  not staged: ${result.not_staged.join(", ")}`);
    }
  }
  return lines;
}

export const task: Command = {
  usage: 'task finish <T-ID> --commit "<message>" [--note "<text>"] [--json]',
  summary: "Finish a task: commit its files with Refs, verify it and move it to done",
  options: { commit: { type: "string" }, note: { type: "string" }, json: { type: "boolean" } },
  async run({ values, positionals }) {
    const action = requirePositional(positionals, 0, "action");
    if (action !== "finish") throw new UsageError(`Unknown task action "${action}". Use finish.`);
    const id = requireTaskId(positionals, 1);
    const message = values.commit as string | undefined;
    if (!message?.trim()) throw new UsageError('task finish needs --commit "<message>".');
    const rt = runtime(values);
    const interrupt = abortOnSignals();
    try {
      const result = await finishTask(rt.root, id, {
        message,
        note: values.note as string | undefined,
        actor: rt.actor,
        session: rt.session,
        signal: interrupt.signal,
      });
      if (result.steps[0]?.status !== "failed") {
        recordInSession(rt.root, rt.session, { touched: [result.feature, id] });
      }
      if (rt.json) printJson(result);
      else for (const line of finishLines(result)) print(line);
      const received = interrupt.received();
      if (received) return 128 + constants.signals[received];
      return result.ok ? 0 : 1;
    } finally {
      interrupt.dispose();
    }
  },
};

export const brief: Command = {
  usage: "brief <T-ID> [--json]",
  summary: "Print the prompt for a subagent building a task, from the records",
  options: { json: { type: "boolean" } },
  run({ values, positionals }) {
    const id = requireTaskId(positionals, 0);
    const rt = runtime(values);
    const text = taskBrief(loadProject(rt.root), id);
    if (rt.json) printJson({ task: id, feature: featureOf(id), text });
    else print(text);
  },
};
