---
completed_at: 2026-09-16
files_changed:
  - path: src/signing/hmac.ts
    change: create
  - path: src/signing/hmac.test.ts
    change: create
deviations: []
follow_ups: []
---
# F-002: As built

## Summary
Every outgoing payload is signed with HMAC-SHA256 and a timestamp; `verify()` rejects tampered and stale requests.

## Deviations
None.

## Follow-ups
None.
