# F-005: Retry with exponential backoff

## ST-005.1 · Schedule a retry after a failed attempt

**Intent:** As the delivery worker, I want each failed attempt turned into a scheduled retry so that transient receiver failures don't lose events.

### S-005.1.1 · Retries a 503 with exponential backoff {happy}

- **GIVEN** Delivery d1 is in_flight with attempt_count 2, policy {base 2 s, factor 2, maxDelay 1 h}, and jitter seeded to return its upper bound
- **WHEN** The receiver responds 503
- **THEN** d1.state = scheduled_retry, attempt_count = 3, next_attempt_at = now + 8 s

### S-005.1.2 · Does not retry a 400 {negative}

- **GIVEN** Delivery d1 is in_flight with attempt_count 1
- **WHEN** The receiver responds 400
- **THEN** d1.state = failed_permanent, next_attempt_at = null, and no retry is scheduled

### S-005.1.3 · Honours Retry-After {edge}

- **GIVEN** Delivery d1 is in_flight with attempt_count 1
- **WHEN** The receiver responds 429 with `Retry-After: 120`
- **THEN** d1.state = scheduled_retry, next_attempt_at = now + 120 s, and no jitter is applied

### S-005.1.4 · Caps Retry-After at maxDelay {edge}

- **GIVEN** Policy maxDelay = 1 h and delivery d1 is in_flight
- **WHEN** The receiver responds 503 with `Retry-After: 86400`
- **THEN** next_attempt_at = now + 1 h

## ST-005.2 · Stop retrying after maxAttempts

**Intent:** As an operator, I want deliveries to stop after a bounded number of attempts so that dead receivers don't consume worker capacity forever.

### S-005.2.1 · Marks a delivery exhausted {happy}

- **GIVEN** Delivery d1 is in_flight with attempt_count 7 and maxAttempts 8
- **WHEN** The receiver responds 500
- **THEN** d1.state = exhausted, attempt_count = 8, and `delivery.exhausted` is emitted once with {deliveryId: d1, attempts: 8}

### S-005.2.2 · Rejects an invalid policy at startup {negative}

- **GIVEN** Config sets retry.maxAttempts = 0
- **WHEN** The service starts
- **THEN** Startup fails with InvalidRetryPolicy {field: "maxAttempts", reason: "must be >= 1"} and exit code 78

## ST-005.3 · Survive worker crashes

**Intent:** As the delivery worker, I want attempts leased so that a crash mid-attempt neither loses the delivery nor counts the attempt twice.

### S-005.3.1 · Completes an attempt within its lease {happy}

- **GIVEN** Delivery d1 is leased by worker w1 with lease_until = now + 30 s
- **WHEN** The receiver responds 200 after 2 s
- **THEN** d1.state = succeeded, lease_until = null, and exactly one attempt row exists

### S-005.3.2 · Recovers an expired lease {edge}

- **GIVEN** Delivery d1 is in_flight with lease_until in the past and attempt_count 3, and its worker process is gone
- **WHEN** Another worker polls for due deliveries
- **THEN** d1 is re-leased and attempted, attempt_count becomes 4 (not 5), and exactly one attempt row exists for attempt 4
