---
files:
  - path: src/api/replay.ts
    change: create
    note: Replay routes
  - path: src/store/deliveries.ts
    change: modify
    note: cloneForReplay() and the replay_of column
  - path: src/api/server.ts
    change: modify
    note: Register the replay routes
  - path: src/signing/hmac.ts
    change: read
    note: sign()
  - path: src/store/endpoints.ts
    change: read
    note: Current endpoint secret
  - path: src/api/replay.test.ts
    change: test
    note: Single replay and signing scenarios
  - path: src/api/replay-bulk.test.ts
    change: test
    note: Bulk replay scenarios
---
