# F-003: Delivery worker

## ST-003.1 · Fan out ingested events

**Intent:** As an event producer, I want each accepted event turned into one delivery per matching endpoint so that every subscriber gets it.

### S-003.1.1 · Creates one delivery per matching endpoint {happy}

- **GIVEN** Endpoints e1 (events ["order.created"]) and e2 (events ["*"]) exist
- **WHEN** A producer sends POST /events with type "order.created"
- **THEN** The response is 202 with {eventId}, and deliveries for e1 and e2 exist with status = pending

### S-003.1.2 · Rejects an event without a type {negative}

- **GIVEN** Endpoint e1 exists
- **WHEN** A producer sends POST /events without a type field
- **THEN** The response is 422 with {field: "type", reason: "required"} and no delivery is created

### S-003.1.3 · Stores an event that matches no endpoint {edge}

- **GIVEN** No endpoint subscribes to "user.deleted"
- **WHEN** A producer sends POST /events with type "user.deleted"
- **THEN** The response is 202, the event row exists, and 0 deliveries are created

## ST-003.2 · Lease and send due deliveries

**Intent:** As the delivery worker, I want to lease due deliveries before sending them so that two workers never send the same delivery at once.

### S-003.2.1 · Sends a due delivery signed {happy}

- **GIVEN** Delivery d1 is pending for endpoint e1
- **WHEN** The worker polls
- **THEN** e1 receives one POST with the payload and a Hookline-Signature header, and d1.status = delivered

### S-003.2.2 · Never leases one delivery to two workers {negative}

- **GIVEN** Delivery d1 is pending and workers w1 and w2 poll at the same instant
- **WHEN** Both call leaseDue() with a batch size of 10
- **THEN** Exactly one of them gets d1

### S-003.2.3 · Gives up on a slow receiver after 15 s {edge}

- **GIVEN** Delivery d1 is pending and e1 takes 20 s to respond
- **WHEN** The worker sends d1
- **THEN** The request is aborted at 15 s and d1.status = failed with last_error = "timeout"

## ST-003.3 · Record the outcome

**Intent:** As an operator, I want every delivery's outcome recorded so that I can see what was delivered and what failed.

### S-003.3.1 · Records a 2xx as delivered {happy}

- **GIVEN** Delivery d1 is leased by worker w1
- **WHEN** e1 responds 204
- **THEN** d1.status = delivered, d1.response_status = 204, and the lease is released

### S-003.3.2 · Records a non-2xx as failed {negative}

- **GIVEN** Delivery d1 is leased by worker w1
- **WHEN** e1 responds 500
- **THEN** d1.status = failed, d1.response_status = 500, and d1.last_error = "HTTP 500"

### S-003.3.3 · Records a refused connection {edge}

- **GIVEN** Delivery d1 is leased and e1's host refuses connections
- **WHEN** The worker sends d1
- **THEN** d1.status = failed, d1.response_status = null, and d1.last_error = "ECONNREFUSED"
