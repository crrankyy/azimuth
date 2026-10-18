import { findProjectRoot } from "../core/paths";
import { actorFromEnv, currentSession } from "../core/session";
import type { Actor } from "../core/types";

const useColor = () => Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const wrap = (code: string) => (text: string) =>
  useColor() ? `\x1b[${code}m${text}\x1b[0m` : text;

export const color = {
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  cyan: wrap("36"),
};

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * Stops quietly when the reader closes the pipe (`azimuth status | head`), as other CLIs do,
 * instead of crashing with an EPIPE stack trace.
 */
export function exitQuietlyOnClosedPipe(
  stream: Pick<NodeJS.EventEmitter, "on">,
  exit: (code: number) => void = (code) => process.exit(code),
): void {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") throw error;
    exit(0);
  });
}

export function print(text = ""): void {
  process.stdout.write(`${text}\n`);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export interface Runtime {
  root: string;
  actor: Actor;
  session: string | null;
  json: boolean;
}

/** Resolves the project root (walking up from --root or the cwd), actor and session. */
export function runtime(values: { root?: string; json?: boolean }): Runtime {
  const start = values.root ?? process.cwd();
  const root = findProjectRoot(start);
  if (!root)
    throw new UsageError(
      `No Azimuth project found from ${start}. Run \`azimuth init\` in the repository root.`,
    );
  return {
    root,
    actor: actorFromEnv(process.env),
    session: currentSession(root, process.env),
    json: values.json ?? false,
  };
}

export function requirePositional(positionals: string[], index: number, name: string): string {
  const value = positionals[index];
  if (!value) throw new UsageError(`Missing <${name}>.`);
  return value;
}
