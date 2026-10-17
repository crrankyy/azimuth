---
updated: 2026-09-02
terms:
  - term: Delivery
    definition: One event destined for one endpoint, tracked until it succeeds or gives up
    aliases: [deliveries]
  - term: Attempt
    definition: A single HTTP request made for a delivery
    aliases: [attempt_count]
  - term: Endpoint
    definition: A subscriber URL with its signing secret and event filter
    aliases: []
  - term: Lease
    definition: A time-bounded claim a worker holds on an in-flight delivery
    aliases: [lease_until]
  - term: Dead letter
    definition: A delivery that ran out of retries, kept with its full attempt history
    aliases: [DLQ]
---
# Glossary

Terms used in specs, code, logs and commit messages.
