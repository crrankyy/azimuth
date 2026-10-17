import type { Db } from "./db";

export interface Endpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
}

interface Row {
  id: string;
  url: string;
  events: string;
  secret: string;
}

const fromRow = (row: Row): Endpoint => ({ ...row, events: JSON.parse(row.events) as string[] });

export function insertEndpoint(db: Db, endpoint: Endpoint): void {
  db.prepare("INSERT INTO endpoints (id, url, events, secret) VALUES (?, ?, ?, ?)").run(
    endpoint.id,
    endpoint.url,
    JSON.stringify(endpoint.events),
    endpoint.secret,
  );
}

export function getEndpoint(db: Db, id: string): Endpoint | undefined {
  const row = db.prepare("SELECT id, url, events, secret FROM endpoints WHERE id = ?").get(id) as Row | undefined;
  return row && fromRow(row);
}

export function listEndpoints(db: Db): Endpoint[] {
  const rows = db.prepare("SELECT id, url, events, secret FROM endpoints ORDER BY created_at").all() as Row[];
  return rows.map(fromRow);
}

export function updateEndpoint(db: Db, id: string, patch: Partial<Pick<Endpoint, "url" | "events">>): Endpoint | undefined {
  const current = getEndpoint(db, id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  db.prepare("UPDATE endpoints SET url = ?, events = ? WHERE id = ?").run(next.url, JSON.stringify(next.events), id);
  return next;
}

export function deleteEndpoint(db: Db, id: string): boolean {
  return db.prepare("DELETE FROM endpoints WHERE id = ?").run(id).changes > 0;
}
