export type DeliveryState =
  | "pending" | "in_flight" | "scheduled_retry"
  | "succeeded" | "failed_permanent" | "exhausted";

export interface RetryPolicy {
  baseDelayMs: number;
  factor: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export type RetryDecision =
  | { kind: "retry"; at: Date; attempt: number }
  | { kind: "permanent"; reason: string }
  | { kind: "exhausted"; attempts: number };

export interface AttemptResult {
  status: number | null;
  headers: Headers;
}

export interface InvalidRetryPolicy {
  kind: "InvalidRetryPolicy";
  field: keyof RetryPolicy;
  reason: string;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
