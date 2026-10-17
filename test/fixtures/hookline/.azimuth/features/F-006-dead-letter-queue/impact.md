---
files:
  - path: src/store/migrations/005_dead_letters.sql
    change: create
    note: dead_letters table
  - path: src/store/dead-letters.ts
    change: create
    note: insertDeadLetter(), listDeadLetters()
  - path: src/worker/dead-letter.ts
    change: create
    note: onExhausted() subscriber
  - path: src/worker/events.ts
    change: modify
    note: Add the delivery.dead_lettered event
  - path: src/store/db.ts
    change: read
    note: withTx() transaction helper
  - path: src/store/dead-letters.test.ts
    change: test
    note: Storage scenarios
  - path: src/worker/dead-letter.test.ts
    change: test
    note: Subscriber scenarios
---
