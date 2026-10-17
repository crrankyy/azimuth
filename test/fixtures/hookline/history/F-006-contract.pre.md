---
language: typescript
---
# F-006: Contract

## Data structures

```ts
export interface DeadLetter {
  deliveryId: string;
  endpointId: string;
  endpointUrl: string;
  payload: Uint8Array;
  lastError: string | null;
  attemptCount: number;
  deadLetteredAt: Date;
}
```

## Public signatures

```ts
export function insertDeadLetter(db: Db, deliveryId: string, now: Date): Result<DeadLetter, DeliveryNotFound>;

export function listDeadLetters(db: Db, opts: { endpointId?: string; limit: number }): DeadLetter[];

export function onExhausted(event: { deliveryId: string; attempts: number }): void;
```

## Errors

```ts
export interface DeliveryNotFound {
  kind: "DeliveryNotFound";
  id: string;
}
```

## State transitions

None. A dead letter is written once and never changes.
