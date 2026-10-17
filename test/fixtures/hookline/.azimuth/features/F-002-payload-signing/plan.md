---
tasks:
  - id: T-002.1
    title: Signature types & scaffolding
    status: done
    after: []
    covers: []
    files: [src/signing/hmac.ts]
    verify: pnpm tsc --noEmit
    note: null
  - id: T-002.2
    title: Sign payloads (red → green)
    status: done
    after: [T-002.1]
    covers: [S-002.1.1, S-002.1.2]
    files: [src/signing/hmac.ts, src/signing/hmac.test.ts]
    verify: pnpm vitest run src/signing/hmac.test.ts
    note: null
  - id: T-002.3
    title: Verify signatures and timestamps (red → green)
    status: done
    after: [T-002.2]
    covers: [S-002.2.1, S-002.2.2, S-002.2.3]
    files: [src/signing/hmac.ts, src/signing/hmac.test.ts]
    verify: pnpm vitest run src/signing/hmac.test.ts
    note: null
---
