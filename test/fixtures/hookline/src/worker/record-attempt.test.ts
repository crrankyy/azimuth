import { afterEach, expect, it } from "vitest";
import { listAttempts } from "../store/attempts";
import { fakeReceiver } from "../../test/support/fake-receiver";
import { seedDelivery, testApp } from "../../test/support/test-app";
import { deliver } from "./deliver";

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((close) => close()));

async function sendTo(url: string, times = 1) {
  const { db } = testApp();
  const { endpoint, delivery } = seedDelivery(db, url);
  for (let i = 0; i < times; i++) await deliver(db, delivery, endpoint, new Date());
  return listAttempts(db, delivery.id);
}

it("S-007.1.1 records a successful attempt", async () => {
  const receiver = await fakeReceiver(200);
  closers.push(receiver.close);
  const [attempt, ...rest] = await sendTo(receiver.url);
  expect(rest).toHaveLength(0);
  expect(attempt).toMatchObject({ attempt: 1, status: 200, error: null });
});

it("S-007.1.2 records a refused connection", async () => {
  const [attempt] = await sendTo("http://127.0.0.1:9/hook");
  expect(attempt).toMatchObject({ status: null, error: "ECONNREFUSED" });
});

it("numbers attempts from 1", async () => {
  const receiver = await fakeReceiver(500);
  closers.push(receiver.close);
  expect((await sendTo(receiver.url, 3)).map((a) => a.attempt)).toEqual([1, 2, 3]);
});
