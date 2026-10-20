---
files:
  - path: src/core/transitions.ts
    change: modify
    note: addLogEntry writes an issue's Status notes bullet with addStatusNote and names the accepted kinds when it refuses; reapproveFeature's verifying refusal explains the done gate
  - path: src/cli/commands/write.ts
    change: modify
    note: The log command's summary names issues' Status notes
  - path: src/core/next.ts
    change: modify
    note: crossFeatureGroups and CrossFeatureGroups, over readyTasks, parallelGroups and byPriority (shared with F-023, which changes nextWork)
  - path: src/cli/commands/read.ts
    change: modify
    note: next without an ID prints the Across line and at most six group lines (groupLine) after the items (shared with F-020's trace change)
  - path: src/server/autostart.ts
    change: modify
    note: waitForExit; ensureViewer waits up to 1 s for a stale viewer and passes --port with the recorded port when the record's config_port matches config.yaml
  - path: src/server/registry.ts
    change: modify
    note: ViewerRecord gains the optional config_port
  - path: src/server/server.ts
    change: modify
    note: A registering server writes config_port (loadConfig's viewer.port) in its record; its port scan is unchanged
  - path: viewer/src/screens/issues/history.ts
    change: modify
    note: A Status notes bullet <stamp> · <actor> · <text> that isn't a move becomes a dated logged entry
  - path: viewer/src/screens/issues/IssueHistory.tsx
    change: modify
    note: The logged entry renders as <who> noted, then the text
  - path: src/core/ids.ts
    change: read
    note: idKind tells an issue ID (BUG-, DEBT-, RISK-) from the IDs featureOf maps to a feature
  - path: src/core/types.ts
    change: read
    note: Index, Feature, Task, Id and Issue, which crossFeatureGroups and the issue branch read
  - path: src/core/gates.ts
    change: read
    note: The done gate checks runs, scenarios, placeholders, as-built and architecture, never the approval
  - path: src/core/spec-hash.ts
    change: read
    note: The approval hash covers the feature.md body, impact.md, stories.md and contract.md, not plan.md
  - path: src/core/derive.ts
    change: read
    note: blocked_by lists a feature's open blocking questions, which keep it out of the groups
  - path: src/core/live.ts
    change: read
    note: processAlive, the default liveness check of waitForExit
  - path: src/core/config.ts
    change: read
    note: loadConfig, which returns defaults instead of throwing, gives viewer.port to the server and to ensureViewer
  - path: src/cli/commands/viewer.ts
    change: read
    note: view --serve takes --port <n>, else viewer.port from config.yaml
  - path: src/hooks/handlers.ts
    change: read
    note: The prompt hook calls ensureViewer(root, 0) and session start ensureViewer(root); both keep their calls
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process as the agent
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes features with priority (extra), tasks, files, after and notes
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG for temp projects
  - path: test/helpers/git.ts
    change: read
    note: initRepo and commitAll for the reapprove and autostart projects
  - path: test/fixtures/hookline/expected-index.ts
    change: read
    note: The index whose BUG-0001 the History test extends
  - path: test/core/transitions.test.ts
    change: test
    note: addLogEntry on an issue (bullet, result, refusals) and the reapprove refusals
  - path: test/cli/log.test.ts
    change: test
    note: azimuth log on a bug and on a question, exit codes, stdout and stderr, then check
  - path: viewer/src/screens/issues/history.test.tsx
    change: test
    note: The History dates a logged Status notes bullet and keeps a bullet in no known form undated
  - path: test/core/next.test.ts
    change: test
    note: crossFeatureGroups order, the blocking-question rule and the two-feature threshold
  - path: test/cli/parallel.test.ts
    change: test
    note: next without an ID prints the cross-feature lines, the shared file, the cap, and keeps next F-NNN and --json
  - path: test/server/autostart.test.ts
    change: test
    note: waitForExit, the record's config_port, and ensureViewer keeping the old port, taking the next one, or following a changed viewer.port
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: 'Step 5''s question bullet shows --option a="Label: detail"; the approval section says plan.md edits need no reapprove'
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: 'The new question row shows --option a="Label: detail"; the log row names issues'
  - path: plugin/skills/bug/SKILL.md
    change: modify
    note: One sentence on logging an issue's progress with azimuth log
  - path: plugin/skills/spec/SKILL.md
    change: read
    note: 'Already shows --option a="<label>: <trade-off>"'
  - path: docs/cli.md
    change: modify
    note: The next, reapprove and log rows, and the cross-feature paragraph after next's groups
  - path: docs/viewer.md
    change: modify
    note: A replaced or restarted viewer keeps its port
  - path: docs/file-format.md
    change: modify
    note: The issue Status notes paragraph adds the bullets azimuth log writes (shared with F-018, F-021 and F-023)
---
# F-024: Impact map

Three separate slices, each in its own source files: `transitions.ts` (log on issues, then the
reapprove refusal), `next.ts` with `read.ts` (cross-feature groups, then their printing) and
`autostart.ts` with the viewer record in `registry.ts` and `server.ts` (the kept port).
`write.ts` changes only the `log` summary. The Issue page's History (`history.ts`,
`IssueHistory.tsx`) dates the new bullet, in the log slice.

`test/cli/log.test.ts` is new; the other tests extend existing files. The skills and docs change
in the last task.
