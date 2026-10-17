import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { listEndpoints } from "./endpoints";

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface Delivery {
  id: string;
  eventId: string;
  endpointId: string;
  status: DeliveryStatus;
  payload: string;
}

const SELECT = "SELECT d.id, d.event_id AS eventId, d.endpoint_id AS endpointId, d.status, e.payload FROM deliveries d JOIN events e ON e.id = d.event_id";

export function insertEvent(db: Db, type: string, payload: unknown): string {
  const eventId = randomUUID();
  db.prepare("INSERT INTO events (id, type, payload) VALUES (?, ?, ?)").run(eventId, type, JSON.stringify(payload));
  const insert = db.prepare("INSERT INTO deliveries (id, event_id, endpoint_id) VALUES (?, ?, ?)");
  for (const endpoint of listEndpoints(db)) {
    if (endpoint.events.includes("*") || endpoint.events.includes(type)) insert.run(randomUUID(), eventId, endpoint.id);
  }
  return eventId;
}

export function getDelivery(db: Db, id: string): Delivery | undefined {
  return db.prepare(`${SELECT} WHERE d.id = ?`).get(id) as Delivery | undefined;
}

export function claimDue(db: Db, workerId: string, limit: number, now: Date, leaseMs: number): Delivery[] {
  const ids = db
    .prepare(
      "UPDATE deliveries SET claimed_by = ?, claimed_until = ? WHERE id IN (SELECT id FROM deliveries WHERE status = 'pending' AND (claimed_until IS NULL OR claimed_until < ?) LIMIT ?) RETURNING id",
    )
    .all(workerId, new Date(now.getTime() + leaseMs).toISOString(), now.toISOString(), limit) as { id: string }[];
  return ids.flatMap(({ id }) => getDelivery(db, id) ?? []);
}

export function recordOutcome(
  db: Db,
  id: string,
  status: DeliveryStatus,
  responseStatus: number | null,
  lastError: string | null,
): void {
  db.prepare(
    "UPDATE deliveries SET status = ?, response_status = ?, last_error = ?, claimed_by = NULL, claimed_until = NULL WHERE id = ?",
  ).run(status, responseStatus, lastError, id);
}
