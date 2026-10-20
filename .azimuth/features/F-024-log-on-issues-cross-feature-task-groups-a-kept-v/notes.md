# F-024: Notes

### T-024.1 · 2026-10-20

T-024.2: the refusal to change is at src/core/transitions.ts:347; put its describe block next to 'F-024 log on issues' (before 'allocation') in transitions.test.ts, using repo() and errorOf(). docs/cli.md's log row still describes the old behaviour (T-024.6).

### T-024.3 · 2026-10-20

T-024.4: call crossFeatureGroups on the same index nextWork uses, only with no ID and no --json. Its feature filter matches nextWork's question-blocked skip, so every grouped task is also one of the printed items. A feature blocked only by a dependency isn't excluded, as the contract says.

### T-024.5 · 2026-10-20

Not built in this task: the bundled server writes records without config_port until the next pnpm build. After it, running viewers are stale and their records lack config_port, so the first replacement starts on the configured viewer.port (ZenithMD's config says 4319 while its viewer runs on 4321: set viewer.port there at rollout). The prompt hook's ensureViewer(root, 0) can take up to 1 s longer that one time.

### T-024.4 · 2026-10-20

Docs (T-024.6): the section is a plain 'Across F-001, F-002:' line, then at most six groupLine lines (the next F-NNN form), then '… and <n> more' (ellipsis as in status --brief); it shows only when at least two in-progress features no question holds have ready tasks, after every item (high issues and the milestone item included). next --json stays an array.
