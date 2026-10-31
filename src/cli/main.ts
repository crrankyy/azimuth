import { parseArgs } from "node:util";
import { isAzimuthError } from "../core/errors";
import { VERSION } from "../core/version";
import { asBuilt } from "./commands/as-built";
import * as harness from "./commands/harness";
import { note } from "./commands/note";
import * as read from "./commands/read";
import { runs } from "./commands/runs";
import { settle } from "./commands/settle";
import { brief, task } from "./commands/task";
import * as viewer from "./commands/viewer";
import * as work from "./commands/work";
import * as write from "./commands/write";
import { color, print, UsageError } from "./io";
import type { Command } from "./types";

const COMMANDS: Record<string, Command> = {
  init: work.init,
  status: read.status,
  show: read.show,
  next: read.next,
  check: read.check,
  index: read.index,
  trace: read.trace,
  runs,
  docs: read.docs,
  new: write.newCommand,
  move: write.move,
  reapprove: write.reapprove,
  answer: write.answer,
  resolve: write.resolve,
  ack: write.ack,
  set: write.set,
  log: write.log,
  note,
  settle,
  "as-built": asBuilt,
  verify: work.verify,
  task,
  brief,
  session: work.session,
  view: viewer.view,
  export: viewer.exportCommand,
  doctor: harness.doctor,
  statusline: harness.statusline,
  hook: harness.hook,
};

function help(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  const lines = Object.entries(COMMANDS)
    .filter(([, c]) => !c.summary.startsWith("(internal)"))
    .map(([name, c]) => `  ${name.padEnd(width)}  ${c.summary}`);
  return `azimuth ${VERSION} — project management for agent-built codebases

Usage: azimuth <command> [options]

Commands:
${lines.join("\n")}

Every command accepts --root <dir> (defaults to the nearest folder with .azimuth/).
Run \`azimuth <command> --help\` for its options. File formats, rules and commands are
documented in \`azimuth docs\`; read them there rather than in Azimuth's code.`;
}

export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === "help" || name === "--help" || name === "-h") {
    print(help());
    return 0;
  }
  if (name === "--version" || name === "-v") {
    print(VERSION);
    return 0;
  }
  const command = COMMANDS[name];
  if (!command) {
    process.stderr.write(`Unknown command "${name}". Run \`azimuth help\`.\n`);
    return 2;
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    print(`Usage: azimuth ${command.usage}\n\n${command.summary}`);
    return 0;
  }
  try {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { root: { type: "string" }, ...command.options },
      allowPositionals: true,
      strict: true,
    });
    return (await command.run({ values: values as never, positionals })) ?? 0;
  } catch (e) {
    if (e instanceof UsageError || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")) {
      process.stderr.write(`${(e as Error).message}\nUsage: azimuth ${command.usage}\n`);
      return 2;
    }
    if (isAzimuthError(e)) {
      process.stderr.write(`${color.red("✗")} ${e.message}\n`);
      if (e.gate) {
        for (const c of e.gate.checks) {
          process.stderr.write(
            `  ${c.ok ? color.green("✓") : color.red("✗")} ${c.rule}${!c.ok && c.detail ? ` — ${c.detail}` : ""}\n`,
          );
        }
      }
      return 1;
    }
    process.stderr.write(`azimuth crashed: ${(e as Error).stack ?? String(e)}\n`);
    return 3;
  }
}
