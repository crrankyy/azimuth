import { sign } from "../signing/hmac";
import type { Db } from "../store/db";
import { recordOutcome, type Delivery } from "../store/deliveries";
import type { Endpoint } from "../store/endpoints";

const TIMEOUT_MS = 15_000;

export async function deliver(db: Db, delivery: Delivery, endpoint: Endpoint, now: Date): Promise<void> {
  const body = new TextEncoder().encode(delivery.payload);
  const signature = sign(endpoint.secret, body, Math.floor(now.getTime() / 1000));
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "hookline-signature": signature },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ok = res.status >= 200 && res.status < 300;
    recordOutcome(db, delivery.id, ok ? "delivered" : "failed", res.status, ok ? null : `HTTP ${res.status}`);
    console.log(`delivery ${delivery.id} -> ${res.status}`);
  } catch (error) {
    recordOutcome(db, delivery.id, "failed", null, errorCode(error));
    console.log(`delivery ${delivery.id} failed: ${errorCode(error)}`);
  }
}

function errorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code ?? String(error);
}
