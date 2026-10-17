---
language: typescript
---
# F-007: Contract

## Data structures

```ts
export interface AttemptRecord {
  deliveryId: string;
  attempt: number;
  startedAt: Date;
  durationMs: number;
  status: number | null;
  error: string | null;
  responseExcerpt: string | null; // first 2048 bytes
  truncated: boolean;
}
```

## Public signatures

```ts
export function insertAttempt(db: Db, record: AttemptRecord): void;

export function listAttempts(db: Db, deliveryId: string): AttemptRecord[];

export function attemptsRoute(app: FastifyInstance, db: Db): void;
```

## Errors

```ts
export interface DeliveryNotFound {
  kind: "DeliveryNotFound";
  id: string;
}
```

## State transitions

None. Attempt rows are append-only.
