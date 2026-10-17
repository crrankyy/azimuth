import { expect, it } from "vitest";
import { classifyResponse } from "./classify";

const none = new Headers();

it("S-005.1.2 does not retry a 400", () => {
  expect(classifyResponse(400, none)).toBe("permanent");
});

it("retries a 408", () => {
  expect(classifyResponse(408, none)).toBe("retryable");
});

it("retries a 429", () => {
  expect(classifyResponse(429, none)).toBe("retryable");
});

it("retries every 5xx", () => {
  for (const status of [500, 502, 503, 504]) expect(classifyResponse(status, none)).toBe("retryable");
});
