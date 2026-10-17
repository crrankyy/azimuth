---
language: typescript
---
# F-001: Contract

## Data structures

```ts
export interface Endpoint {
  id: string;
  url: string;
  events: string[]; // exact event types, or ["*"]
  secret: string; // 32 random bytes, base64url
  createdAt: Date;
}

export type EndpointView = Omit<Endpoint, "secret">;
```

## Public signatures

```ts
export function insertEndpoint(db: Db, input: { url: string; events: string[] }): Result<Endpoint, InvalidEndpoint>;

export function updateEndpoint(
  db: Db, id: string, patch: Partial<Pick<Endpoint, "url" | "events">>,
): Result<EndpointView, EndpointNotFound | InvalidEndpoint>;

export function deleteEndpoint(db: Db, id: string): Result<void, EndpointNotFound>;
```

## Errors

```ts
export interface EndpointNotFound {
  kind: "EndpointNotFound";
  id: string;
}

export interface InvalidEndpoint {
  kind: "InvalidEndpoint";
  field: "url" | "events";
  reason: string;
}
```

## State transitions

None. Endpoints are created, updated and deleted; they have no states.
