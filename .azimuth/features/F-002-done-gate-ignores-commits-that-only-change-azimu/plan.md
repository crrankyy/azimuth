---
tasks:
  - id: T-002.1
    title: Code-commit helpers
    status: done
    after: []
    covers: []
    files: [src/core/derive.ts, test/core/analysis.test.ts]
    verify: pnpm typecheck && pnpm exec vitest run test/core/analysis.test.ts -t "code commits"
    note: null
  - id: T-002.2
    title: Verify runs stay current across record-only commits (red → green)
    status: done
    after: [T-002.1]
    covers: [S-002.1.1, S-002.1.2, S-002.1.3]
    files: [src/core/gates.ts, test/core/analysis.test.ts]
    verify: pnpm exec vitest run test/core/analysis.test.ts -t S-002.1
    note: null
  - id: T-002.3
    title: Architecture compared with the last code commit (red → green)
    status: done
    after: [T-002.1]
    covers: [S-002.2.1, S-002.2.2]
    files: [src/core/gates.ts, test/core/analysis.test.ts]
    verify: pnpm exec vitest run test/core/analysis.test.ts -t S-002.2
    note: null
  - id: T-002.4
    title: Close-out in its natural order, against real git
    status: done
    after: [T-002.2, T-002.3]
    covers: [S-002.3.1, S-002.3.2]
    files: [test/core/git-trace.test.ts]
    verify: pnpm exec vitest run test/core/git-trace.test.ts -t S-002.3
    note: null
  - id: T-002.5
    title: Verify skill, docs and full verification
    status: done
    after: [T-002.4]
    covers: []
    files: [plugin/skills/verify/SKILL.md, docs/concepts.md, test/golden/index.test.ts]
    verify: pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm exec vitest run --no-file-parallelism
    note: null
---
# F-002: Plan

The helpers come first with their own tests; each gate check then changes test-first. The
real-git test (T-002.4) is the acceptance test for the close-out order the skill will describe, so
it lands once both checks are in. The golden test is part of the full run and must not change.
