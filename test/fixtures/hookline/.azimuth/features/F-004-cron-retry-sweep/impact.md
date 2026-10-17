---
files:
  - path: src/worker/sweep.ts
    change: create
    note: sweepFailed() and startSweep()
  - path: src/worker/loop.ts
    change: modify
    note: Start the 30 s sweep timer
  - path: src/store/deliveries.ts
    change: modify
    note: listRetryable() and requeue()
  - path: src/config/schema.ts
    change: modify
    note: sweep section with validation
  - path: src/worker/sweep.test.ts
    change: test
    note: Sweep scenarios
---
