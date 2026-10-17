---
language: typescript
---
# F-009: Contract

## Data structures

```ts
export interface TokenBucket {
  capacity: number; // = rateLimitPerSecond
  tokens: number;
  refilledAtMs: number;
}

export type RateLimiter = Map<string, TokenBucket>; // by endpoint ID
```

## Public signatures

```ts
export function takeToken(bucket: TokenBucket, nowMs: number): { ok: boolean; bucket: TokenBucket };

export function leaseDue(db: Db, workerId: string, now: Date, limiter: RateLimiter): Delivery[];
```

## Errors

```ts
export interface InvalidRateLimit {
  kind: "InvalidRateLimit";
  field: "rateLimitPerSecond";
  reason: string;
}
```

## State transitions

None. A postponed delivery keeps its state.
