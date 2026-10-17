# F-007: Delivery attempt log

## ST-007.1 · Record every attempt

**Intent:** As an operator, I want each HTTP attempt recorded so that I can see exactly what happened to a delivery.

### S-007.1.1 · Records a successful attempt {happy}

- **GIVEN** Delivery d1 is pending for endpoint e1
- **WHEN** The worker sends d1 and e1 responds 200 in 120 ms
- **THEN** One attempts row exists for d1 with attempt = 1, status = 200, duration_ms = 120 and error = null

### S-007.1.2 · Records a refused connection {negative}

- **GIVEN** Delivery d1 is pending and e1's host refuses connections
- **WHEN** The worker sends d1
- **THEN** One attempts row exists for d1 with status = null and error = "ECONNREFUSED"

### S-007.1.3 · Truncates a large response body {edge}

- **GIVEN** e1 responds 500 with a 64 KB body
- **WHEN** The attempt is recorded
- **THEN** response_excerpt holds the first 2048 bytes and truncated = true

## ST-007.2 · Expose the attempt history

**Intent:** As an operator, I want to fetch a delivery's attempts over HTTP so that I can debug a receiver without database access.

### S-007.2.1 · Lists attempts oldest first {happy}

- **GIVEN** Delivery d1 has 3 attempts
- **WHEN** A client sends GET /deliveries/d1/attempts
- **THEN** The response is 200 with 3 items ordered by attempt ascending

### S-007.2.2 · Returns 404 for an unknown delivery {negative}

- **GIVEN** Delivery d9 does not exist
- **WHEN** A client sends GET /deliveries/d9/attempts
- **THEN** The response is 404 with {error: "delivery_not_found"}
