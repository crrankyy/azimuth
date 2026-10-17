import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { sign, verify } from "./hmac";

const secret = "s1";
const body = new TextEncoder().encode('{"id":"evt_1"}');
const t = 1_760_000_000;

it("S-002.1.1 signs the exact payload bytes", () => {
  const mac = createHmac("sha256", secret).update(`${t}.`).update(body).digest("hex");
  expect(sign(secret, body, t)).toBe(`t=${t},v1=${mac}`);
});

it("S-002.1.2 signs an empty body", () => {
  const mac = createHmac("sha256", secret).update(`${t}.`).digest("hex");
  expect(sign(secret, new Uint8Array(), t)).toBe(`t=${t},v1=${mac}`);
});

it("S-002.2.1 verifies a fresh signature", () => {
  expect(verify(secret, body, sign(secret, body, t - 30), t)).toEqual({ ok: true });
});

it("S-002.2.2 rejects a tampered payload", () => {
  const tampered = new TextEncoder().encode('{"id":"evt_2"}');
  expect(verify(secret, tampered, sign(secret, body, t), t)).toEqual({ ok: false, reason: "signature_mismatch" });
});

it("S-002.2.3 rejects a stale timestamp", () => {
  expect(verify(secret, body, sign(secret, body, t - 301), t)).toEqual({
    ok: false,
    reason: "timestamp_outside_tolerance",
  });
});

it("rejects a malformed header", () => {
  expect(verify(secret, body, "v1=abc", t)).toEqual({ ok: false, reason: "malformed_header" });
});

it("rejects a signature made with another secret", () => {
  expect(verify(secret, body, sign("s2", body, t), t)).toEqual({ ok: false, reason: "signature_mismatch" });
});

it("is deterministic for the same timestamp", () => {
  expect(sign(secret, body, t)).toBe(sign(secret, body, t));
});
