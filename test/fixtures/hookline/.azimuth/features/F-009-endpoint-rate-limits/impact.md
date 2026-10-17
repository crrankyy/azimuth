---
files:
  - path: src/worker/rate-limit.ts
    change: create
    note: TokenBucket and takeToken()
  - path: src/store/migrations/006_rate_limits.sql
    change: create
    note: rate_limit_per_s column
  - path: src/store/endpoints.ts
    change: modify
    note: Read and write rate_limit_per_s
  - path: src/api/endpoints.ts
    change: modify
    note: Accept rateLimitPerSecond on PATCH
  - path: src/worker/lease.ts
    change: modify
    note: Skip endpoints without tokens
  - path: src/worker/loop.ts
    change: modify
    note: Share one limiter across polls
  - path: src/worker/rate-limit.test.ts
    change: test
    note: Token bucket scenarios
  - path: src/api/endpoints.rate-limit.test.ts
    change: test
    note: Configuration scenarios
  - path: src/worker/lease.rate-limit.test.ts
    change: test
    note: Leasing scenarios
---
