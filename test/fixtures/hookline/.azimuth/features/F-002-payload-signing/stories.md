# F-002: Payload signing

## ST-002.1 · Sign outgoing payloads

**Intent:** As a receiver, I want each request signed with my endpoint secret so that I can verify it came from Hookline.

### S-002.1.1 · Signs the exact payload bytes {happy}

- **GIVEN** Endpoint e1 has secret s1 and the payload is {"id":"evt_1"}
- **WHEN** The worker signs the payload at t = 1760000000
- **THEN** The Hookline-Signature header is t=1760000000,v1=<hex HMAC-SHA256 of "1760000000." + payload with s1>

### S-002.1.2 · Signs an empty body {edge}

- **GIVEN** Endpoint e1 has secret s1 and the payload is empty
- **WHEN** The worker signs the payload at t = 1760000000
- **THEN** The signature covers "1760000000." and the Hookline-Signature header is present

## ST-002.2 · Reject replayed requests

**Intent:** As a receiver, I want a signed timestamp in every request so that a captured request can't be replayed later.

### S-002.2.1 · Verifies a fresh signature {happy}

- **GIVEN** A request signed with s1 at t = now - 30 s
- **WHEN** verify() checks it with a tolerance of 300 s
- **THEN** It returns {ok: true}

### S-002.2.2 · Rejects a tampered payload {negative}

- **GIVEN** A request signed with s1 whose body was changed after signing
- **WHEN** verify() checks it
- **THEN** It returns {ok: false, reason: "signature_mismatch"}

### S-002.2.3 · Rejects a stale timestamp {edge}

- **GIVEN** A request signed with s1 at t = now - 301 s
- **WHEN** verify() checks it with a tolerance of 300 s
- **THEN** It returns {ok: false, reason: "timestamp_outside_tolerance"}
