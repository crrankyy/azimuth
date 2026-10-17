import { afterEach, expect, it } from "vitest";
import { getDelivery } from "../store/deliveries";
import { fakeReceiver } from "../../test/support/fake-receiver";
import { seedDelivery, testApp } from "../../test/support/test-app";
import { deliver } from "./deliver";

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((close) => close()));

async function send(status: number, options: { delayMs?: number } = {}) {
  const receiver = await fakeReceiver(status, options);
  closers.push(receiver.close);
  const { db } = testApp();
  const { endpoint, delivery } = seedDelivery(db, receiver.url);
  await deliver(db, delivery, endpoint, new Date());
  const row = db.prepare("SELECT * FROM deliveries WHERE id = ?").get(delivery.id) as Record<string, unknown>;
  return { receiver, row, db, delivery };
}

it("S-003.2.3 gives up on a slow receiver after 15 s", { timeout: 20_000 }, async () => {
  const { row } = await send(200, { delayMs: 20_000 });
  expect(row).toMatchObject({ status: "failed", last_error: "timeout" });
});

it("S-003.3.1 records a 2xx as delivered", async () => {
  const { row } = await send(204);
  expect(row).toMatchObject({ status: "delivered", response_status: 204, claimed_by: null });
});

it("S-003.3.2 records a non-2xx as failed", async () => {
  const { row } = await send(500);
  expect(row).toMatchObject({ status: "failed", response_status: 500, last_error: "HTTP 500" });
});

it("S-003.3.3 records a refused connection", async () => {
  const { db } = testApp();
  const { endpoint, delivery } = seedDelivery(db, "http://127.0.0.1:9/hook");
  await deliver(db, delivery, endpoint, new Date());
  expect(db.prepare("SELECT last_error FROM deliveries WHERE id = ?").pluck().get(delivery.id)).toBe("ECONNREFUSED");
});

it("sends the payload as JSON", async () => {
  const { receiver } = await send(200);
  expect(receiver.received[0]?.headers["content-type"]).toBe("application/json");
});

it("signs every request", async () => {
  const { receiver, db, delivery } = await send(200);
  expect(receiver.received[0]?.headers["hookline-signature"]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  expect(getDelivery(db, delivery.id)?.status).toBe("delivered");
});
