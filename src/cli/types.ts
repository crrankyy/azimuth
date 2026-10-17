import type { ParseArgsConfig } from "node:util";

export interface CommandInput {
  values: Record<string, string | boolean | string[] | undefined> & {
    root?: string;
    json?: boolean;
  };
  positionals: string[];
}

export interface Command {
  usage: string;
  summary: string;
  options?: ParseArgsConfig["options"];
  /** Returns the exit code (0 when omitted). */
  run(input: CommandInput): number | void | Promise<number | void>;
}
