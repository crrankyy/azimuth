import { sign } from "../signing/hmac";
import { countAttempts, excerpt, insertAttempt } from "../store/attempts";
import type { Db } from "../store/db";
import { recordOutcome, type Delivery } from "../store/deliveries";
import type { Endpoint } from "../store/endpoints";

const TIMEOUT_MS = 15_000;

export async function deliver(db: Db, delivery: Delivery, endpoint: Endpoint, now: Date): Promise<void> {
  const body = new TextEncoder().encode(delivery.payload);
  const signature = sign(endpoint.secret, body, Math.floor(now.getTime() / 1000));
  const startedAt = new Date();
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "hookline-signature": signature },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ok = res.status >= 200 && res.status < 300;
    recordAttempt(db, delivery.id, startedAt, res.status, null, await res.text());
    recordOutcome(db, delivery.id, ok ? "delivered" : "failed", res.status, ok ? null : `HTTP ${res.status}`);
    console.log(`delivery ${delivery.id} -> ${res.status}`);
  } catch (error) {
    recordAttempt(db, delivery.id, startedAt, null, errorCode(error), null);
    recordOutcome(db, delivery.id, "failed", null, errorCode(error));
    console.log(`delivery ${delivery.id} failed: ${errorCode(error)}`);
  }
}

function recordAttempt(
  db: Db,
  deliveryId: string,
  startedAt: Date,
  status: number | null,
  error: string | null,
  responseBody: string | null,
): void {
  try {
    insertAttempt(db, {
      deliveryId,
      attempt: countAttempts(db, deliveryId) + 1,
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      status,
      error,
      ...excerpt(responseBody),
    });
  } catch (insertError) {
    // Recording is best-effort: losing an attempt row must never fail the delivery.
    console.error(`could not record an attempt for ${deliveryId}: ${String(insertError)}`);
  }
}

function errorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code ?? String(error);
}
