import { expect, it } from "vitest";
import { testApp } from "../../test/support/test-app";

const hook = "https://example.test/hook";

async function register(events: string[] = ["order.created"], url = hook) {
  const { app } = testApp();
  const res = await app.inject({ method: "POST", url: "/endpoints", payload: { url, events } });
  return { app, res, id: res.json().id as string };
}

it("S-001.1.1 registers an endpoint and returns its secret once", async () => {
  const { app, res, id } = await register();
  expect(res.statusCode).toBe(201);
  expect(res.json().secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect((await app.inject({ url: `/endpoints/${id}` })).json()).not.toHaveProperty("secret");
});

it("S-001.1.2 rejects a malformed URL", async () => {
  const { res } = await register(["order.created"], "not a url");
  expect(res.statusCode).toBe(422);
  expect(res.json()).toEqual({ field: "url", reason: "must be an absolute URL" });
});

it("S-001.1.3 accepts the wildcard event filter", async () => {
  const { app, id } = await register(["*"]);
  const res = await app.inject({ url: `/endpoints/${id}` });
  expect(res.statusCode).toBe(200);
  expect(res.json().events).toEqual(["*"]);
});

it("S-001.2.1 updates the event filter", async () => {
  const { app, id } = await register();
  const events = ["order.created", "order.paid"];
  const res = await app.inject({ method: "PATCH", url: `/endpoints/${id}`, payload: { events } });
  expect(res.statusCode).toBe(200);
  expect(res.json().events).toEqual(events);
});

it("S-001.2.2 returns 404 for an unknown endpoint", async () => {
  const { app } = testApp();
  const res = await app.inject({ method: "DELETE", url: "/endpoints/e9" });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: "endpoint_not_found" });
});

it("S-001.2.3 rejects an empty event filter", async () => {
  const { app, id } = await register();
  const res = await app.inject({ method: "PATCH", url: `/endpoints/${id}`, payload: { events: [] } });
  expect(res.statusCode).toBe(422);
  expect(res.json()).toEqual({ field: "events", reason: "must not be empty" });
});

it("rejects an ftp:// URL", async () => {
  const { res } = await register(["order.created"], "ftp://example.test/hook");
  expect(res.json()).toEqual({ field: "url", reason: "must be http or https" });
});

it("lists endpoints without their secrets", async () => {
  const { app } = await register();
  const [endpoint] = (await app.inject({ url: "/endpoints" })).json();
  expect(endpoint).not.toHaveProperty("secret");
});

it("deletes an endpoint", async () => {
  const { app, id } = await register();
  expect((await app.inject({ method: "DELETE", url: `/endpoints/${id}` })).statusCode).toBe(204);
  expect((await app.inject({ url: `/endpoints/${id}` })).statusCode).toBe(404);
});
