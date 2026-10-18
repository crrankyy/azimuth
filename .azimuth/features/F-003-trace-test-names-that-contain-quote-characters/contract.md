---
language: typescript
---
# F-003: Contract

## Data structures

Unchanged: `TestRef { file: string; name: string; confidence: "marker" | "fallback" }`.

## Public signatures

```ts
// src/core/trace.ts (signature unchanged; the title pattern changes)
export function scanTestFile(text: string, file: string): Map<string, TestRef[]>;
```

## Errors

None.

## State transitions
None.
