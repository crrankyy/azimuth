---
files:
  - path: src/core/derive.ts
    change: modify
    note: Tell code commits from commits that only change .azimuth/
  - path: src/core/gates.ts
    change: modify
    note: The done gate's verify and architecture checks ignore record-only commits
  - path: src/core/git.ts
    change: read
    note: Changed files per commit are already read into the git facts
  - path: test/core/analysis.test.ts
    change: test
    note: Gate checks with record-only and code commits
  - path: test/core/git-trace.test.ts
    change: test
    note: Close-out in its natural order against a real git history
  - path: test/golden/index.test.ts
    change: test
    note: The sample project's gates must not change
  - path: plugin/skills/verify/SKILL.md
    change: modify
    note: Natural close-out order
  - path: docs/concepts.md
    change: modify
    note: What the done gate counts
---
# F-002: Impact map
