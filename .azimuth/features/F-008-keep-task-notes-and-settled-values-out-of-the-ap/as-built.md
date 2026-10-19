---
completed_at: 2026-10-20
files_changed:
  - { path: src/core/placeholders.ts, change: create }
  - { path: src/core/notes.ts, change: create }
  - { path: src/core/settle.ts, change: create }
  - { path: src/cli/commands/note.ts, change: create }
  - { path: src/cli/commands/settle.ts, change: create }
  - { path: src/cli/main.ts, change: modify }
  - { path: src/core/spec-hash.ts, change: modify }
  - { path: src/core/types.ts, change: modify }
  - { path: src/core/model.ts, change: modify }
  - { path: src/core/build-index.ts, change: modify }
  - { path: src/core/gates.ts, change: modify }
  - { path: src/core/inbox.ts, change: modify }
  - { path: src/core/transitions.ts, change: modify }
  - { path: src/core/delta.ts, change: modify }
  - { path: viewer/src/screens/feature/StoriesTab.tsx, change: modify }
  - { path: viewer/src/screens/feature/feature.css, change: modify }
  - { path: viewer/src/screens/feature/AsBuiltTab.tsx, change: modify }
  - { path: viewer/src/screens/feature/featureData.ts, change: modify }
  - { path: viewer/src/screens/feature/FeatureDetail.tsx, change: modify }
  - { path: test/core/notes.test.ts, change: create }
  - { path: test/cli/note.test.ts, change: create }
  - { path: test/core/placeholders.test.ts, change: create }
  - { path: test/core/settle.test.ts, change: create }
  - { path: test/cli/settle.test.ts, change: create }
  - { path: test/core/settle-gate.test.ts, change: create }
  - { path: test/core/settle-review.test.ts, change: create }
  - { path: test/core/analysis.test.ts, change: modify }
  - { path: test/core/git-trace.test.ts, change: modify }
  - { path: test/fixtures/hookline/expected-index.ts, change: modify }
  - { path: viewer/src/screens/feature/AsBuiltTab.test.tsx, change: create }
  - { path: viewer/src/screens/feature/StoriesTab.test.tsx, change: create }
  - { path: plugin/skills/spec/SKILL.md, change: modify }
  - { path: plugin/skills/build/SKILL.md, change: modify }
  - { path: plugin/skills/azimuth/SKILL.md, change: modify }
  - { path: src/core/protocol.ts, change: modify }
  - { path: docs/cli.md, change: modify }
  - { path: docs/concepts.md, change: modify }
  - { path: docs/file-format.md, change: modify }
  - { path: docs/viewer.md, change: modify }
deviations:
  - { path: src/cli/commands/note.ts, kind: duplicated-code, reason: "note.ts and src/cli/commands/settle.ts build the session's touched list themselves ([feature, ref], or just the feature for an F-ID) because touch() in write.ts, which impact.md names as the pattern, isn't exported" }
  - { path: viewer/src/screens/feature/AsBuiltTab.tsx, kind: markup-change, reason: "The close-out sentence is one template string, shared by the empty state and the line above the notes, so it renders as one text node; renderToStaticMarkup, which the tests use, gives the same HTML as the old JSX text around the ID" }
  - { path: src/core/settle.ts, kind: error-order, reason: "settleValue checks its refusals in this order: ID format, feature, value, scenario, no {?} left. contract.md's error table lists the value before the feature, so a bad value for a scenario of a missing feature reports that the feature doesn't exist; settleText still checks the value before the scenario, as specified" }
  - { path: src/core/placeholders.ts, kind: clarification, reason: "unreviewedSettles counts a settle only when it is strictly after review_ack_at. Both are written to the second, so a settle logged in the same second as the acknowledgement counts as reviewed" }
  - { path: .azimuth/features/F-008-keep-task-notes-and-settled-values-out-of-the-ap/feature.md, kind: spec-change, reason: "Revised before approval so the Review list covers features you approved too: acknowledge in transitions.ts accepts them, delta.ts words their acknowledgement differently, and T-008.6 waited for F-012's build, which edits the same files (f58e603 before 6b06d5f). The approved spec (ad55c04) already says so" }
follow_ups: [DEBT-0007, BUG-0071]
---
# F-008: As built

## Summary
`azimuth note <T-ID|F-ID> "<text>"` appends a `### <ref> · <UTC date>` section to the feature's
`notes.md` (`addNote` in the new `src/core/notes.ts`), creating it under a `# F-NNN: Notes`
title. The index carries it as `detail.notes` without the title line (`null` when nothing else
is left), and `specHash` never reads it. A THEN or AND line may hold `{?}`:
`azimuth settle <S-ID> "<value>"` (`settleValue`, new `src/core/settle.ts`) replaces the
scenario's first `{?}` with `{=<value>}`, logs `Settled <S-ID>: {=<value>}` as a note in the same
locked step and says how many placeholders the scenario has left. Both commands add their IDs to
the session's `touched`. The placeholder rules live in the new `src/core/placeholders.ts`, which
imports no Node modules. `specHash` maps every `{=…}` in stories.md back to `{?}` before hashing,
so settling leaves the approval current and a spec without placeholders hashes as before.

The done gate gains `done.placeholders-settled` between `done.scenarios-passing` and
`done.as-built`; it names the scenarios that still hold a `{?}` outside fenced code. Values an
agent settled after `review_ack_at` reach the inbox's Review list whoever approved the feature:
inside the automatic approval's item while that is unacknowledged, otherwise as their own
`review-auto` item. `azimuth ack F-…` also accepts a feature you approved that has such values,
and agents hear it as "acknowledged the values settled in F-…".

In the viewer, the As-built tab opens once a feature has notes (`asBuiltOpen`) and lists them
after the as-built sections, or under the close-out line before close-out. The Stories tab marks
a settled value with ✓ and the title "settled by test", and an open one reads "to be settled",
in plain text and code spans alike. The spec and build skills, the azimuth skill's CLI reference,
the protocol template and the CLI, concepts, file-format and viewer docs describe notes, `{?}`
and `settle`. The Hookline golden index changed only by `notes: null` in F-005's detail and the
passing `done.placeholders-settled` check in F-007's next gate.

## Deviations
- `note.ts` and `settle.ts` build the session's `touched` list themselves (`[feature, ref]`, or
  just the feature for an F-ID). impact.md names `touch()` in `write.ts` as the pattern, but it
  isn't exported, so its logic is repeated.
- The close-out sentence in `AsBuiltTab.tsx` is one template string, shared by the empty state
  and the line above the notes, so it renders as one text node. The HTML the tests read is the
  same as with the old JSX text around the ID.
- `settleValue` checks its refusals in this order: the ID's format, the feature, the value, the
  scenario, then whether a `{?}` is left. contract.md's error table lists the value before the
  feature, so a bad value for a scenario of a missing feature reports `F-NNN does not exist.`
  `settleText` still checks the value before the scenario, as specified.
- `unreviewedSettles` counts a settle only when it is strictly after `review_ack_at`. Both are
  written to the second, so a settle logged in the same second as your acknowledgement counts as
  reviewed.
- The spec was revised before approval so that the Review list covers features you approved too:
  `acknowledge` accepts such a feature, `delta.ts` words its acknowledgement as "acknowledged the
  values settled in F-…", and T-008.6 waited for F-012's build, which edits the same files. The
  approved spec (ad55c04) already describes this.

Otherwise the files match `impact.md`.

## Follow-ups
- DEBT-0007: note and settle duplicate `touch()` and `readOr`.
- BUG-0071: acknowledging settled values reaches agents as acknowledging the automatic approval.
