import type { AttemptResult, InvalidRetryPolicy, Result, RetryDecision, RetryPolicy } from "./types";

export const DEFAULT_POLICY: RetryPolicy = {
  baseDelayMs: 2_000,
  factor: 2,
  maxDelayMs: 3_600_000,
  maxAttempts: 8,
};

export function computeDelay(
  _policy: RetryPolicy,
  _attempt: number,
  _retryAfterMs: number | null,
  _rand: () => number,
): number {
  throw new Error("not implemented");
}

export function decideRetry(
  _policy: RetryPolicy,
  _attempt: number,
  _result: AttemptResult,
  _now: Date,
  _rand: () => number = Math.random,
): RetryDecision {
  throw new Error("not implemented");
}

export function parseRetryPolicy(_raw: unknown): Result<RetryPolicy, InvalidRetryPolicy> {
  throw new Error("not implemented");
}
