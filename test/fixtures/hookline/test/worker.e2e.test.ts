import { afterEach, expect, it } from "vitest";
import { leaseDue } from "../src/worker/lease";
import { deliver } from "../src/worker/deliver";
import { getEndpoint } from "../src/store/endpoints";
import { fakeReceiver } from "./support/fake-receiver";
import { seedDelivery, testApp } from "./support/test-app";

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((close) => close()));

async function pollOnce(db: ReturnType<typeof testApp>["db"]) {
  for (const delivery of leaseDue(db, "w1", new Date())) {
    const endpoint = getEndpoint(db, delivery.endpointId);
    if (endpoint) await deliver(db, delivery, endpoint, new Date());
  }
}

it("S-003.2.1 sends a due delivery signed", async () => {
  const receiver = await fakeReceiver(200);
  closers.push(receiver.close);
  const { db } = testApp();
  seedDelivery(db, receiver.url, { id: "evt_1" });
  await pollOnce(db);
  expect(receiver.received).toHaveLength(1);
  expect(receiver.received[0]?.body).toBe('{"id":"evt_1"}');
  expect(receiver.received[0]?.headers["hookline-signature"]).toBeDefined();
});

it("delivers one event to two endpoints", async () => {
  const [one, two] = await Promise.all([fakeReceiver(200), fakeReceiver(200)]);
  closers.push(one!.close, two!.close);
  const { db } = testApp();
  seedDelivery(db, one!.url);
  seedDelivery(db, two!.url);
  await pollOnce(db);
  expect(one!.received.length + two!.received.length).toBeGreaterThanOrEqual(2);
});
