import type { Db } from "./db";

export interface AttemptRecord {
  deliveryId: string;
  attempt: number;
  startedAt: Date;
  durationMs: number;
  status: number | null;
  error: string | null;
  responseExcerpt: string | null;
  truncated: boolean;
}

const EXCERPT_BYTES = 2048;

export function excerpt(body: string | null): Pick<AttemptRecord, "responseExcerpt" | "truncated"> {
  if (body === null) return { responseExcerpt: null, truncated: false };
  const bytes = new TextEncoder().encode(body);
  if (bytes.length <= EXCERPT_BYTES) return { responseExcerpt: body, truncated: false };
  return { responseExcerpt: new TextDecoder().decode(bytes.slice(0, EXCERPT_BYTES)), truncated: true };
}

export function insertAttempt(db: Db, record: AttemptRecord): void {
  db.prepare(
    "INSERT INTO attempts (delivery_id, attempt, started_at, duration_ms, status, error, response_excerpt, truncated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    record.deliveryId,
    record.attempt,
    record.startedAt.toISOString(),
    record.durationMs,
    record.status,
    record.error,
    record.responseExcerpt,
    record.truncated ? 1 : 0,
  );
}

export function countAttempts(db: Db, deliveryId: string): number {
  return db.prepare("SELECT count(*) FROM attempts WHERE delivery_id = ?").pluck().get(deliveryId) as number;
}

export function listAttempts(db: Db, deliveryId: string): AttemptRecord[] {
  const rows = db
    .prepare(
      "SELECT delivery_id AS deliveryId, attempt, started_at AS startedAt, duration_ms AS durationMs, status, error, response_excerpt AS responseExcerpt, truncated FROM attempts WHERE delivery_id = ? ORDER BY attempt",
    )
    .all(deliveryId) as (Omit<AttemptRecord, "startedAt" | "truncated"> & { startedAt: string; truncated: number })[];
  return rows.map((row) => ({ ...row, startedAt: new Date(row.startedAt), truncated: row.truncated === 1 }));
}
