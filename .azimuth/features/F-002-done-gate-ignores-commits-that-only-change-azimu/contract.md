---
language: typescript
---
# F-002: Contract

## Data structures

None new: the git facts already hold each commit's changed files (`facts.git.files`).

## Public signatures

```ts
// src/core/derive.ts
/** Whether a commit changed anything outside `.azimuth/`; a commit with unknown files counts. */
export function isCodeCommit(sha: string, facts: Facts): boolean;
/**
 * Whether any commit after `sha`, up to HEAD, is a code commit; null when `sha` isn't in the
 * history the index read.
 */
export function codeChangedSince(sha: string, facts: Facts): boolean | null;
```

## Errors

None.

## State transitions
None.
