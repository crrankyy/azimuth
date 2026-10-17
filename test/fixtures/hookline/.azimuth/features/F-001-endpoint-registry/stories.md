# F-001: Endpoint registry

## ST-001.1 · Register an endpoint

**Intent:** As an operator, I want to register a subscriber URL with an event filter so that the service knows where to deliver matching events.

### S-001.1.1 · Registers an endpoint and returns its secret once {happy}

- **GIVEN** No endpoint exists for https://example.test/hook
- **WHEN** An operator sends POST /endpoints with url https://example.test/hook and events ["order.created"]
- **THEN** The response is 201 with {id, url, events, secret}, and the secret is 43 base64url characters

### S-001.1.2 · Rejects a malformed URL {negative}

- **GIVEN** No endpoints exist
- **WHEN** An operator sends POST /endpoints with url "not a url"
- **THEN** The response is 422 with {field: "url", reason: "must be an absolute URL"} and no row is written

### S-001.1.3 · Accepts the wildcard event filter {edge}

- **GIVEN** No endpoints exist
- **WHEN** An operator registers an endpoint with events ["*"]
- **THEN** GET /endpoints/:id returns 200 with events ["*"] and no secret field

## ST-001.2 · Update and remove endpoints

**Intent:** As an operator, I want to change or remove an endpoint so that deliveries follow the subscriber's current setup.

### S-001.2.1 · Updates the event filter {happy}

- **GIVEN** Endpoint e1 exists with events ["order.created"]
- **WHEN** An operator sends PATCH /endpoints/e1 with events ["order.created", "order.paid"]
- **THEN** The response is 200 with the new events, and e1's secret is unchanged

### S-001.2.2 · Returns 404 for an unknown endpoint {negative}

- **GIVEN** Endpoint e9 does not exist
- **WHEN** An operator sends DELETE /endpoints/e9
- **THEN** The response is 404 with {error: "endpoint_not_found"}

### S-001.2.3 · Rejects an empty event filter {edge}

- **GIVEN** Endpoint e1 exists with events ["order.created"]
- **WHEN** An operator sends PATCH /endpoints/e1 with events []
- **THEN** The response is 422 with {field: "events", reason: "must not be empty"} and e1 is unchanged
