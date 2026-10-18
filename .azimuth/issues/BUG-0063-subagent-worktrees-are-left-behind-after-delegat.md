---
id: BUG-0063
type: bug
title: Subagent worktrees are left behind after delegated tasks
status: open
severity: low
likelihood: null
impact: null
links: []
files: [plugin/skills/build/SKILL.md, src/core/init.ts]
found_by: SES-20261018-1745
created: 2026-10-18
resolved_at: null
---
## Repro
Let an orchestrator run tasks in subagents with worktree isolation; it copies their files into the main checkout and commits.

## Expected
The orchestrator removes each worktree (and its branch) once it has taken the change, and `.claude/worktrees/` never shows as untracked.

## Actual
Four worktrees under `.claude/worktrees/` with their changes and four `worktree-agent-*` branches remain, and `git status` lists `.claude/worktrees/`, where a `git add -A` could pick them up as embedded repositories.

Found in the subagent-delegation rehearsal on 2026-10-18 (Sonnet orchestrating Haiku subagents, ~/projects/azimuth-rust-rehearsal F-002).
