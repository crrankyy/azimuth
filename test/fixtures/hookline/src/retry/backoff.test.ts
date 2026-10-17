import { expect, it } from "vitest";
import { lowerBound, upperBound } from "../../test/support/seeded-random";
import { computeDelay, decideRetry, DEFAULT_POLICY } from "./policy";

const now = new Date("2026-10-18T11:00:00Z");
const after = (ms: number) => new Date(now.getTime() + ms);
const response = (status: number, headers: Record<string, string> = {}) => ({
  status,
  headers: new Headers(headers),
});

it("S-005.1.1 retries a 503 with exponential backoff", () => {
  const decision = decideRetry(DEFAULT_POLICY, 2, response(503), now, upperBound);
  expect(decision).toEqual({ kind: "retry", attempt: 3, at: after(8_000) });
});

it("S-005.1.3 honours Retry-After", () => {
  const decision = decideRetry(DEFAULT_POLICY, 1, response(429, { "retry-after": "120" }), now, upperBound);
  expect(decision).toEqual({ kind: "retry", attempt: 2, at: after(120_000) });
});

it("S-005.1.4 caps Retry-After at maxDelay", () => {
  const decision = decideRetry(DEFAULT_POLICY, 1, response(503, { "retry-after": "86400" }), now, upperBound);
  expect(decision).toEqual({ kind: "retry", attempt: 2, at: after(3_600_000) });
});

it("doubles the jitter cap with each attempt", () => {
  expect(computeDelay(DEFAULT_POLICY, 1, null, upperBound)).toBe(2_000);
  expect(computeDelay(DEFAULT_POLICY, 2, null, upperBound)).toBe(4_000);
});

it("never waits longer than maxDelayMs", () => {
  expect(computeDelay(DEFAULT_POLICY, 30, null, upperBound)).toBe(3_600_000);
});

it("can retry immediately when jitter draws 0", () => {
  expect(computeDelay(DEFAULT_POLICY, 4, null, lowerBound)).toBe(0);
});
