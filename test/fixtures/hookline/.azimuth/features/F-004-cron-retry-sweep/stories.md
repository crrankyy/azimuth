# F-004: Cron retry sweep

## ST-004.1 · Retry failed deliveries on a schedule

**Intent:** As an operator, I want failed deliveries retried by a periodic sweep so that temporary receiver outages don't lose events.

### S-004.1.1 · Re-queues failed deliveries {happy}

- **GIVEN** Deliveries d1 and d2 have status = failed after a 503 and retries = 0
- **WHEN** The sweep runs
- **THEN** d1 and d2 have status = pending and retries = 1

### S-004.1.2 · Leaves 4xx failures alone {negative}

- **GIVEN** Delivery d1 failed with response_status 400
- **WHEN** The sweep runs
- **THEN** d1 keeps status = failed and retries = 0

### S-004.1.3 · Skips a tick while a sweep is running {edge}

- **GIVEN** A sweep has been running for 31 s
- **WHEN** The next 30 s tick fires
- **THEN** No second sweep starts and the skipped tick is counted in sweep_skipped_total

## ST-004.2 · Give up after five retries

**Intent:** As an operator, I want the sweep to stop after a fixed number of retries so that dead receivers aren't retried forever.

### S-004.2.1 · Abandons a delivery after 5 retries {happy}

- **GIVEN** Delivery d1 has status = failed and retries = 5
- **WHEN** The sweep runs
- **THEN** d1.status = abandoned and d1 is not re-queued

### S-004.2.2 · Rejects a retry limit of 0 {negative}

- **GIVEN** Config sets sweep.maxRetries = 0
- **WHEN** The service starts
- **THEN** Startup fails with InvalidSweepConfig {field: "maxRetries", reason: "must be >= 1"}

### S-004.2.3 · Counts a retry once across a restart {edge}

- **GIVEN** The sweep re-queued d1 and the process restarted before d1 was sent
- **WHEN** The sweep runs again
- **THEN** d1.retries = 1
