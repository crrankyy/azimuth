import { expect, it } from "vitest";
import { insertAttempt } from "../store/attempts";
import { seedDelivery, testApp } from "../../test/support/test-app";

function appWithAttempts(count: number) {
  const { app, db } = testApp();
  const { delivery } = seedDelivery(db, "https://one.test/hook");
  for (let attempt = count; attempt >= 1; attempt--) {
    insertAttempt(db, {
      deliveryId: delivery.id,
      attempt,
      startedAt: new Date(Date.UTC(2026, 9, 17, 15, attempt)),
      durationMs: 40,
      status: 503,
      error: null,
      responseExcerpt: null,
      truncated: false,
    });
  }
  return { app, url: `/deliveries/${delivery.id}/attempts` };
}

it("S-007.2.1 lists attempts oldest first", async () => {
  const { app, url } = appWithAttempts(3);
  const res = await app.inject({ url });
  expect(res.statusCode).toBe(200);
  expect(res.json().map((a: { attempt: number }) => a.attempt)).toEqual([1, 2, 3]);
});

it("S-007.2.2 returns 404 for an unknown delivery", async () => {
  const { app } = testApp();
  const res = await app.inject({ url: "/deliveries/d9/attempts" });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: "delivery_not_found" });
});

it("returns timestamps as ISO strings", async () => {
  const { app, url } = appWithAttempts(1);
  const [attempt] = (await app.inject({ url })).json();
  expect(attempt.startedAt).toBe("2026-10-17T15:01:00.000Z");
});
