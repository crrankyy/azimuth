# F-009: Per-endpoint rate limiting

## ST-009.1 · Configure a limit per endpoint

**Intent:** As an operator, I want to set a maximum delivery rate on an endpoint so that a slow receiver isn't overwhelmed.

### S-009.1.1 · Stores a rate limit on an endpoint {happy}

- **GIVEN** Endpoint e1 exists without a rate limit
- **WHEN** An operator sends PATCH /endpoints/e1 with rateLimitPerSecond 5
- **THEN** The response is 200 with rateLimitPerSecond = 5

### S-009.1.2 · Rejects a limit below 1 {negative}

- **GIVEN** Endpoint e1 exists
- **WHEN** An operator sends PATCH /endpoints/e1 with rateLimitPerSecond 0
- **THEN** The response is 422 with {field: "rateLimitPerSecond", reason: "must be >= 1"}

## ST-009.2 · Enforce the limit in the worker

**Intent:** As a receiver, I want Hookline to stay under my configured rate so that bursts don't take my service down.

### S-009.2.1 · Sends at most the limit per second {happy}

- **GIVEN** Endpoint e1 has rateLimitPerSecond 5 and 20 due deliveries
- **WHEN** The worker runs for 1 s
- **THEN** e1 receives at most 5 requests in that second

### S-009.2.2 · Leaves other endpoints unaffected {edge}

- **GIVEN** Endpoint e1 is limited to 1 per second and endpoint e2 has no limit, each with 10 due deliveries
- **WHEN** The worker runs for 1 s
- **THEN** e2 receives 10 requests and e1 receives 1

### S-009.2.3 · Refills tokens after an idle period {edge}

- **GIVEN** Endpoint e1 has rateLimitPerSecond 5 and was idle for 10 s
- **WHEN** 8 deliveries for e1 become due
- **THEN** e1 receives 5 requests at once and the other 3 within the next second

## ST-009.3 · Postpone rather than fail limited deliveries

**Intent:** As an operator, I want rate-limited deliveries postponed so that throttling never counts as a failed attempt.

### S-009.3.1 · Postpones a delivery without a token {happy}

- **GIVEN** Endpoint e1 has no tokens left and delivery d1 is due
- **WHEN** The worker leases due deliveries
- **THEN** d1 is not leased, attempt_count is unchanged, and d1 is due again within 1 s

### S-009.3.2 · Never counts a postponement as an attempt {negative}

- **GIVEN** Delivery d1 was postponed 3 times by the limiter
- **WHEN** d1 is sent and the receiver responds 200
- **THEN** d1 has exactly 1 attempt row
