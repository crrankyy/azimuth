---
files:
  - path: src/retry/types.ts
    change: create
    note: RetryPolicy, RetryDecision, DeliveryState, InvalidRetryPolicy
  - path: src/retry/policy.ts
    change: create
    note: decideRetry(), computeDelay(), parseRetryPolicy()
  - path: src/retry/classify.ts
    change: create
    note: "classifyResponse(): retryable or permanent"
  - path: src/store/migrations/004_retry.sql
    change: create
    note: attempt_count, next_attempt_at, state, lease_until columns
  - path: src/worker/deliver.ts
    change: modify
    note: Call decideRetry() after each attempt and persist the schedule
  - path: src/config/schema.ts
    change: modify
    note: retry section with validation
  - path: src/store/db.ts
    change: read
    note: withTx() transaction helper
  - path: src/retry/backoff.test.ts
    change: test
    note: Backoff and Retry-After scenarios
  - path: src/retry/classify.test.ts
    change: test
    note: Response classification scenarios
  - path: src/retry/policy.test.ts
    change: test
    note: Exhaustion and policy validation scenarios
  - path: test/worker.crash.test.ts
    change: test
    note: Lease expiry and crash recovery
---
