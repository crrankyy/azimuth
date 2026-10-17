import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "signature_mismatch" | "timestamp_outside_tolerance" | "malformed_header" };

const HEADER = /^t=(\d+),v1=([0-9a-f]{64})$/;

function mac(secret: string, body: Uint8Array, t: number): string {
  return createHmac("sha256", secret).update(`${t}.`).update(body).digest("hex");
}

export function sign(secret: string, body: Uint8Array, t: number): string {
  return `t=${t},v1=${mac(secret, body, t)}`;
}

export function verify(secret: string, body: Uint8Array, header: string, now: number, toleranceS = 300): VerifyResult {
  const match = HEADER.exec(header);
  if (!match) return { ok: false, reason: "malformed_header" };
  const t = Number(match[1]);
  if (Math.abs(now - t) > toleranceS) return { ok: false, reason: "timestamp_outside_tolerance" };
  const expected = Buffer.from(mac(secret, body, t), "hex");
  const actual = Buffer.from(match[2] ?? "", "hex");
  return timingSafeEqual(expected, actual) ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
