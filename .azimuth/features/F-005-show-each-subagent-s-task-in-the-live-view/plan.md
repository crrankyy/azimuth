---
tasks:
  - id: T-005.1
    title: Types & scaffolding
    status: done
    after: []
    covers: []
    files: [src/core/types.ts, src/core/live.ts, src/hooks/handlers.ts, src/cli/commands/harness.ts, plugin/hooks/hooks.json]
    verify: pnpm typecheck
    note: null
  - id: T-005.2
    title: Hooks record launches, starts and stops (red → green)
    status: done
    after: [T-005.1]
    covers: [S-005.1.1, S-005.1.2, S-005.1.3, S-005.1.4, S-005.1.5, S-005.1.6]
    files: [src/hooks/handlers.ts, src/core/live.ts, test/hooks/hooks.test.ts]
    verify: pnpm build && pnpm exec vitest run test/hooks/hooks.test.ts -t S-005.1 --reporter=verbose
    note: null
  - id: T-005.3
    title: Live sessions match subagents to launches (red → green)
    status: done
    after: [T-005.2]
    covers: [S-005.2.1, S-005.2.2, S-005.2.3, S-005.2.4, S-005.2.5, S-005.2.6]
    files: [src/core/live.ts, test/core/live.test.ts]
    verify: pnpm exec vitest run test/core/live.test.ts -t S-005.2 --reporter=verbose
    note: null
  - id: T-005.4
    title: Lanes named after their assignment (red → green)
    status: done
    after: [T-005.1]
    covers: [S-005.3.1, S-005.3.2, S-005.3.3, S-005.3.4]
    files: [viewer/src/screens/activity/LiveStrip.tsx, viewer/src/screens/activity/activity.css, viewer/src/screens/activity/LiveStrip.test.tsx]
    verify: pnpm exec vitest run viewer/src/screens/activity/LiveStrip.test.tsx --reporter=verbose
    note: null
  - id: T-005.5
    title: Wake-ups follow every feature in flight (red → green)
    status: done
    after: [T-005.2, T-005.3]
    covers: [S-005.4.1, S-005.4.2]
    files: [src/hooks/handlers.ts, test/hooks/hooks.test.ts]
    verify: pnpm build && pnpm exec vitest run test/hooks/hooks.test.ts -t S-005.4 --reporter=verbose
    note: null
  - id: T-005.6
    title: Docs and full verification
    status: done
    after: [T-005.4, T-005.5]
    covers: []
    files: [docs/claude-code.md, docs/viewer.md]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run
    note: null
---
# F-005: Plan

Test-first. After the scaffolding (T-005.1), the hooks (T-005.2) and the viewer (T-005.4) touch
separate files and can be built in parallel. The matching in `live.ts` (T-005.3) comes after the
hooks, which also use `launchRefs` from `live.ts`. Wake-ups
(T-005.5) need both the hook records and the matching. Hook tests run against the built CLI, so
their verify commands build first.
