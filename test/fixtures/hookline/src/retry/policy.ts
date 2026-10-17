import type { AttemptResult, InvalidRetryPolicy, Result, RetryDecision, RetryPolicy } from "./types";

export const DEFAULT_POLICY: RetryPolicy = {
  baseDelayMs: 2_000,
  factor: 2,
  maxDelayMs: 3_600_000,
  maxAttempts: 8,
};

/** Full jitter (ADR-0003): a random delay up to the exponential cap; Retry-After wins when present. */
export function computeDelay(
  policy: RetryPolicy,
  attempt: number,
  retryAfterMs: number | null,
  rand: () => number,
): number {
  if (retryAfterMs !== null) return Math.min(retryAfterMs, policy.maxDelayMs);
  const cap = Math.min(policy.maxDelayMs, policy.baseDelayMs * policy.factor ** (attempt - 1));
  return Math.floor(rand() * cap);
}

export function decideRetry(
  policy: RetryPolicy,
  attempt: number,
  result: AttemptResult,
  now: Date,
  rand: () => number = Math.random,
): RetryDecision {
  const next = attempt + 1;
  const delay = computeDelay(policy, next, retryAfterMs(result.headers), rand);
  return { kind: "retry", at: new Date(now.getTime() + delay), attempt: next };
}

export function parseRetryPolicy(_raw: unknown): Result<RetryPolicy, InvalidRetryPolicy> {
  throw new Error("not implemented");
}

function retryAfterMs(headers: Headers): number | null {
  const value = headers.get("retry-after");
  if (value === null) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}
