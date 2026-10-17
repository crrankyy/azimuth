import { expect, it } from "vitest";
import { seedDelivery, testApp } from "../../test/support/test-app";
import { excerpt, insertAttempt, listAttempts } from "./attempts";

it("S-007.1.3 truncates a large response body", () => {
  const result = excerpt("x".repeat(64 * 1024));
  expect(result.responseExcerpt).toHaveLength(2048);
  expect(result.truncated).toBe(true);
});

it("keeps a short body whole", () => {
  expect(excerpt("ok")).toEqual({ responseExcerpt: "ok", truncated: false });
});

it("lists attempts by attempt number", () => {
  const { db } = testApp();
  const { delivery } = seedDelivery(db, "https://one.test/hook");
  const base = { deliveryId: delivery.id, startedAt: new Date(), durationMs: 5, status: 500, error: null, responseExcerpt: null, truncated: false };
  insertAttempt(db, { ...base, attempt: 2 });
  insertAttempt(db, { ...base, attempt: 1 });
  expect(listAttempts(db, delivery.id).map((a) => a.attempt)).toEqual([1, 2]);
});
