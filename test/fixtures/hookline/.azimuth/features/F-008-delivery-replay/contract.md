---
language: typescript
---
# F-008: Contract

## Data structures

```ts
export interface ReplayRequest {
  deliveryId: string;
  requestedBy: string;
}

export interface ReplayResult {
  replayId: string;
  replayOf: string;
}

export interface BulkReplayResult {
  replayed: number;
  remaining: number;
}
```

## Public signatures

```ts
export function replayDelivery(db: Db, req: ReplayRequest, now: Date): Result<ReplayResult, ReplayError>;

export function replayDeadLetters(db: Db, endpointId: string, limit: number, now: Date): BulkReplayResult;
```

## Errors

```ts
export type ReplayError =
  | { kind: "DeliveryNotFound"; id: string }
  | { kind: "DeliveryInFlight"; id: string }
  | { kind: "EndpointDeleted"; endpointId: string };
```

## State transitions

None. A replay creates a new delivery that follows the normal delivery lifecycle.
