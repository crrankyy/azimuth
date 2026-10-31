---
completed_at: 2026-10-31
files_changed:
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: docs/viewer.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: src/cli/commands/write.ts, change: modify }
  - { path: src/cli/main.ts, change: modify }
  - { path: src/core/git.ts, change: modify }
  - { path: src/core/init.ts, change: modify }
  - { path: src/core/milestone-page.ts, change: modify }
  - { path: src/core/parse/records.ts, change: modify }
  - { path: src/core/protocol.ts, change: modify }
  - { path: src/core/release.ts, change: create }
  - { path: src/core/transitions.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/server/actions.ts, change: modify }
  - { path: test/cli/milestone.test.ts, change: modify }
  - { path: test/cli/release.test.ts, change: create }
  - { path: test/core/milestone-page.test.ts, change: modify }
  - { path: test/core/parse.test.ts, change: modify }
  - { path: test/core/refs.test.ts, change: create }
  - { path: test/core/release-page.test.ts, change: create }
  - { path: test/core/release.test.ts, change: create }
  - { path: test/core/task-brief.test.ts, change: modify }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
  - { path: test/server/release-action.test.ts, change: create }
  - { path: viewer/src/screens/roadmap/Timeline.test.tsx, change: create }
  - { path: viewer/src/screens/roadmap/Timeline.tsx, change: modify }
  - { path: viewer/src/screens/roadmap/release.test.ts, change: create }
  - { path: viewer/src/screens/roadmap/release.ts, change: create }
  - { path: viewer/src/screens/roadmap/roadmap.css, change: modify }
deviations:
  - { path: test/cli/milestone.test.ts, kind: unplanned-modify, reason: "F-026's S-026.4.2 compares show --json with the whole milestone entity, which gained tag and released_commit (T-028.1); adopted into T-028.7." }
  - { path: test/core/milestone-page.test.ts, kind: unplanned-modify, reason: "F-026's S-026.3.1 compares the whole page, which gained commits (T-028.5); adopted into T-028.5." }
  - { path: test/core/task-brief.test.ts, kind: unplanned-modify, reason: "F-022's S-022.2.4 quotes the conventions template's Commits line, which S-028.1.6 changes; adopted into T-028.7." }
follow_ups: []
---
# F-028: As built

## Summary
Built as specced in eight tasks. Milestones read `tag` and `released_commit` (`r.text()`, so a
digits-only SHA stays text). `releaseMilestone` (`src/core/release.ts`) is the one release path
for the CLI's user-only `azimuth release` and the viewer's new `release` action: it checks the
features, passes a planned milestone through active in one write and records the date, the tag
and the commit (the tag's when git has it, else HEAD). `azimuth move M-NN released` is
unchanged. The viewer offers Release on a planned milestone whose features are all done
(BUG-0084), and the Roadmap shows a released label and up to five commits per expanded lane. The
milestone page gained release and commits sections. The protocol and the conventions template
say a `Refs:` trailer may name a milestone or an issue; `commitRefs` already linked them.

## Deviations

## Follow-ups
None. BUG-0084 is fixed by T-028.4. Projects run `azimuth init --refresh` to get the new PROTOCOL.md.
