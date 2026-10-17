import { expect, it } from "vitest";
import { insertEvent } from "../store/deliveries";
import { insertEndpoint } from "../store/endpoints";
import { testApp } from "../../test/support/test-app";
import { BATCH_SIZE, leaseDue } from "./lease";

const now = new Date("2026-09-21T10:00:00Z");

function dbWithDeliveries(count: number) {
  const { db } = testApp();
  insertEndpoint(db, { id: "e1", url: "https://one.test/hook", events: ["*"], secret: "s1" });
  for (let i = 0; i < count; i++) insertEvent(db, "order.created", { i });
  return db;
}

it("S-003.2.2 never leases one delivery to two workers", () => {
  const db = dbWithDeliveries(1);
  const leased = [...leaseDue(db, "w1", now), ...leaseDue(db, "w2", now)];
  expect(leased).toHaveLength(1);
});

it("leases at most one batch per call", () => {
  expect(leaseDue(dbWithDeliveries(25), "w1", now)).toHaveLength(BATCH_SIZE);
});

it("leases a delivery again once its lease has expired", () => {
  const db = dbWithDeliveries(1);
  leaseDue(db, "w1", now);
  expect(leaseDue(db, "w2", new Date(now.getTime() + 31_000))).toHaveLength(1);
});
