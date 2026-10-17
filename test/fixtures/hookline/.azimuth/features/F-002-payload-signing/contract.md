---
language: typescript
---
# F-002: Contract

## Data structures

```ts
export interface SignatureHeader {
  t: number; // unix seconds
  v1: string; // hex HMAC-SHA256 of `${t}.${body}`
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "signature_mismatch" | "timestamp_outside_tolerance" | "malformed_header" };
```

## Public signatures

```ts
export function sign(secret: string, body: Uint8Array, t: number): string;

export function verify(
  secret: string, body: Uint8Array, header: string, now: number, toleranceS?: number,
): VerifyResult;
```

## Errors

None. `verify()` reports failures in its result.

## State transitions

None. Signing is stateless.
