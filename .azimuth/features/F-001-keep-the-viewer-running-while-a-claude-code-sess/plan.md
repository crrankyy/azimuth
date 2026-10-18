---
tasks:
  - id: T-001.1
    title: Types & scaffolding
    status: todo
    after: []
    covers: []
    files: [src/core/live.ts, src/hooks/handlers.ts, src/server/server.ts, src/cli/commands/harness.ts]
    verify: pnpm typecheck
    note: null
  - id: T-001.2
    title: Open-session rule (red → green)
    status: todo
    after: [T-001.1]
    covers: [S-001.1.2, S-001.1.3, S-001.1.4]
    files: [src/core/live.ts, test/core/live.test.ts]
    verify: pnpm exec vitest run test/core/live.test.ts
    note: null
  - id: T-001.3
    title: Viewer stays up while a session is open (red → green)
    status: todo
    after: [T-001.2]
    covers: [S-001.1.1]
    files: [src/server/server.ts, test/server/server.test.ts]
    verify: pnpm exec vitest run test/server/server.test.ts -t S-001
    note: null
  - id: T-001.4
    title: Hooks record Claude Code's process ID (red → green)
    status: todo
    after: [T-001.1]
    covers: [S-001.2.1, S-001.2.2, S-001.2.3]
    files: [src/hooks/handlers.ts, test/hooks/hooks.test.ts]
    verify: pnpm exec vitest run test/hooks/hooks.test.ts -t S-001.2
    note: null
  - id: T-001.5
    title: Prompt hook restarts a stopped viewer (red → green)
    status: todo
    after: [T-001.4]
    covers: [S-001.3.1, S-001.3.2]
    files: [src/hooks/handlers.ts, src/cli/commands/harness.ts, test/hooks/hooks.test.ts]
    verify: pnpm exec vitest run test/hooks/hooks.test.ts -t S-001.3
    note: null
  - id: T-001.6
    title: Docs and full verification
    status: todo
    after: [T-001.3, T-001.5]
    covers: []
    files: [docs/viewer.md, docs/claude-code.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run --no-file-parallelism
    note: null
---
# F-001: Plan

Test-first: the rule for an open session is pure and tested on its own (T-001.2), then wired
into the server's idle check (T-001.3). The hooks record the process ID (T-001.4) before the
prompt hook learns to restart the viewer (T-001.5). The full suite runs file by file, because
two wall-clock budget tests fail under parallel load on this machine.
