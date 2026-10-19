import { main } from "../../src/cli/main";

export interface CliResult {
  /** What main() returned (0 success, 1 refused, 2 usage, 3 internal). */
  code: number;
  out: string;
  err: string;
}

const BASE_ENV: Record<string, string | undefined> = {
  AZIMUTH_ACTOR: "agent",
  NO_COLOR: "1",
  AZIMUTH_NO_VIEWER: "1",
  // The developer's own Claude Code session would otherwise leak into the command's session.
  AZIMUTH_SESSION: undefined,
  AZIMUTH_CLAUDE_SESSION: undefined,
  CLAUDE_CODE_SESSION_ID: undefined,
};

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function capture(stream: NodeJS.WriteStream, sink: string[]): () => void {
  const original = stream.write;
  stream.write = ((chunk: string | Uint8Array) => {
    sink.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof stream.write;
  return () => {
    stream.write = original;
  };
}

/**
 * Runs `azimuth <args> --root <root>` in-process through main() and captures what it writes to
 * process.stdout and process.stderr. Runs with AZIMUTH_ACTOR=agent, NO_COLOR=1 and
 * AZIMUTH_NO_VIEWER=1, and without AZIMUTH_SESSION, AZIMUTH_CLAUDE_SESSION or
 * CLAUDE_CODE_SESSION_ID unless `env` sets them; restores the environment afterwards.
 */
export async function runCli(
  root: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<CliResult> {
  const values = { ...BASE_ENV, ...env };
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const out: string[] = [];
  const err: string[] = [];
  setEnv(values);
  const restoreOut = capture(process.stdout, out);
  const restoreErr = capture(process.stderr, err);
  try {
    const code = await main([...args, "--root", root]);
    return { code, out: out.join(""), err: err.join("") };
  } finally {
    restoreOut();
    restoreErr();
    setEnv(saved);
  }
}
