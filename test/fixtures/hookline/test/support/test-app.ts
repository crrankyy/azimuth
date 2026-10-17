import { randomUUID } from "node:crypto";
import { buildServer } from "../../src/api/server";
import { openDb, type Db } from "../../src/store/db";
import { getDelivery, insertEvent } from "../../src/store/deliveries";
import { insertEndpoint, type Endpoint } from "../../src/store/endpoints";

export function testApp() {
  const db = openDb(":memory:");
  return { db, app: buildServer(db) };
}

/** One endpoint subscribed to everything and one pending delivery for it. */
export function seedDelivery(db: Db, url: string, payload: unknown = { id: "evt_1" }) {
  const endpoint: Endpoint = { id: randomUUID(), url, events: ["*"], secret: "s1" };
  insertEndpoint(db, endpoint);
  insertEvent(db, "order.created", payload);
  const id = db.prepare("SELECT id FROM deliveries WHERE endpoint_id = ?").pluck().get(endpoint.id) as string;
  return { endpoint, delivery: getDelivery(db, id)! };
}
