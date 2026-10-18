---
language: typescript
---
# F-004: Contract

## Data structures

Unchanged: `NextItem { ref; title; action; reason }`.

## Public signatures

```ts
// src/core/next.ts (signature unchanged; the idea case changes)
export function nextForFeature(index: Index, f: Feature): NextItem[];
```

## Errors

None.

## State transitions
None.
