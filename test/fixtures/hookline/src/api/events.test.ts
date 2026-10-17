import { expect, it } from "vitest";
import { insertEndpoint } from "../store/endpoints";
import { testApp } from "../../test/support/test-app";

function appWithEndpoints() {
  const { app, db } = testApp();
  insertEndpoint(db, { id: "e1", url: "https://one.test/hook", events: ["order.created"], secret: "s1" });
  insertEndpoint(db, { id: "e2", url: "https://two.test/hook", events: ["*"], secret: "s2" });
  const count = (sql: string) => db.prepare(sql).pluck().get() as number;
  return { app, count };
}

it("S-003.1.1 creates one delivery per matching endpoint", async () => {
  const { app, count } = appWithEndpoints();
  const res = await app.inject({ method: "POST", url: "/events", payload: { type: "order.created", payload: {} } });
  expect(res.statusCode).toBe(202);
  expect(count("SELECT count(*) FROM deliveries WHERE status = 'pending'")).toBe(2);
});

it("S-003.1.2 rejects an event without a type", async () => {
  const { app, count } = appWithEndpoints();
  const res = await app.inject({ method: "POST", url: "/events", payload: { payload: {} } });
  expect(res.json()).toEqual({ field: "type", reason: "required" });
  expect(count("SELECT count(*) FROM deliveries")).toBe(0);
});

it("S-003.1.3 stores an event that matches no endpoint", async () => {
  const { app, count } = appWithEndpoints();
  await app.inject({ method: "POST", url: "/events", payload: { type: "user.deleted", payload: {} } });
  expect(count("SELECT count(*) FROM events")).toBe(1);
  expect(count("SELECT count(*) FROM deliveries WHERE endpoint_id = 'e1'")).toBe(0);
});

it("returns the event id", async () => {
  const { app } = appWithEndpoints();
  const res = await app.inject({ method: "POST", url: "/events", payload: { type: "order.created" } });
  expect(res.json().eventId).toMatch(/^[0-9a-f-]{36}$/);
});
