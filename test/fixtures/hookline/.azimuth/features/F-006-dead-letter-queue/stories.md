# F-006: Dead-letter queue

## ST-006.1 · Dead-letter exhausted deliveries

**Intent:** As an operator, I want deliveries that run out of retries moved to a dead-letter queue so that no event is silently lost.

### S-006.1.1 · Dead-letters an exhausted delivery {happy}

- **GIVEN** Delivery d1 has state = exhausted after 8 attempts
- **WHEN** `delivery.exhausted` is emitted for d1
- **THEN** One dead_letters row exists for d1, and `delivery.dead_lettered` is emitted once with {deliveryId: d1}

### S-006.1.2 · Ignores a repeated exhausted event {negative}

- **GIVEN** d1 already has a dead_letters row
- **WHEN** `delivery.exhausted` is emitted for d1 again
- **THEN** Exactly one row exists for d1 and no event is emitted

### S-006.1.3 · Keeps the endpoint URL after the endpoint is deleted {edge}

- **GIVEN** Delivery d1 is exhausted and its endpoint e1 was deleted afterwards
- **WHEN** `delivery.exhausted` is emitted for d1
- **THEN** The dead_letters row has endpoint_id = e1 and the endpoint_url that d1 was sent to

## ST-006.2 · Keep what failed for inspection

**Intent:** As an operator, I want each dead letter to keep its payload and last error so that I can see why the delivery died.

### S-006.2.1 · Stores the payload and last error {happy}

- **GIVEN** Delivery d1 exhausted with last_error "HTTP 503"
- **WHEN** d1 is dead-lettered
- **THEN** The row holds d1's payload bytes and last_error = "HTTP 503"

### S-006.2.2 · Rejects an unknown delivery {negative}

- **GIVEN** Delivery d9 does not exist
- **WHEN** insertDeadLetter() is called for d9
- **THEN** It returns DeliveryNotFound {id: "d9"} and writes no row

### S-006.2.3 · Stores a payload larger than 1 MB {edge}

- **GIVEN** Delivery d1's payload is 1.5 MB
- **WHEN** d1 is dead-lettered
- **THEN** The stored payload is byte-identical to d1's payload
