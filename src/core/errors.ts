import type { Gate } from "./types";

export type ErrorCode = "invalid" | "not-found" | "policy" | "conflict" | "busy" | "gate";

/** An expected failure with a message meant for the user (or agent) who ran the command. */
export class AzimuthError extends Error {
  readonly code: ErrorCode;
  readonly gate: Gate | null;

  constructor(code: ErrorCode, message: string, gate: Gate | null = null) {
    super(message);
    this.name = "AzimuthError";
    this.code = code;
    this.gate = gate;
  }
}

export function isAzimuthError(e: unknown): e is AzimuthError {
  return e instanceof AzimuthError;
}
