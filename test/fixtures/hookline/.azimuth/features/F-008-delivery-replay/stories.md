# F-008: Delivery replay API

Scenarios in ST-008.2 depend on the answer to Q-0003.

## ST-008.1 · Replay a delivery on demand

**Intent:** As an operator, I want to re-send any past delivery so that I can recover events a receiver lost or mishandled.

### S-008.1.1 · Replays a delivered event {happy}

- **GIVEN** Delivery d1 has state = succeeded
- **WHEN** An operator sends POST /deliveries/d1/replay
- **THEN** The response is 202 with {replayId}, and a new delivery exists with replay_of = d1 and state = pending

### S-008.1.2 · Returns 404 for an unknown delivery {negative}

- **GIVEN** Delivery d9 does not exist
- **WHEN** An operator sends POST /deliveries/d9/replay
- **THEN** The response is 404 with {error: "delivery_not_found"}

### S-008.1.3 · Rejects a replay while the delivery is in flight {edge}

- **GIVEN** Delivery d1 has state = in_flight
- **WHEN** An operator sends POST /deliveries/d1/replay
- **THEN** The response is 409 with {error: "delivery_in_flight"} and no delivery is created

## ST-008.2 · Sign replayed payloads

**Intent:** As a receiver, I want replayed requests signed like live ones so that my signature check keeps working.

### S-008.2.1 · Signs a replay with a fresh timestamp {happy}

- **GIVEN** Delivery d1 was first sent at t0 and endpoint e1's secret is unchanged
- **WHEN** d1 is replayed at t1
- **THEN** The Hookline-Signature header carries t = t1 and verifies with e1's secret

### S-008.2.2 · Replays after the endpoint secret was rotated {edge}

- **GIVEN** Endpoint e1's secret was rotated after d1 was first sent
- **WHEN** An operator replays d1
- **THEN** the request is handled appropriately

### S-008.2.3 · Rejects a replay to a deleted endpoint {negative}

- **GIVEN** Endpoint e1 was deleted after d1 was sent
- **WHEN** An operator sends POST /deliveries/d1/replay
- **THEN** The response is 410 with {error: "endpoint_deleted"}

## ST-008.3 · Replay dead letters in bulk

**Intent:** As an operator, I want to replay every dead letter of an endpoint at once so that recovering from an outage takes one request.

### S-008.3.1 · Replays every dead letter of an endpoint {happy}

- **GIVEN** Endpoint e1 has 3 dead letters
- **WHEN** An operator sends POST /endpoints/e1/dead-letters/replay
- **THEN** The response is 202 with {replayed: 3} and 3 new pending deliveries exist

### S-008.3.2 · Caps a bulk replay at 1000 deliveries {edge}

- **GIVEN** Endpoint e1 has 1500 dead letters
- **WHEN** An operator sends POST /endpoints/e1/dead-letters/replay
- **THEN** The response is 202 with {replayed: 1000, remaining: 500}
