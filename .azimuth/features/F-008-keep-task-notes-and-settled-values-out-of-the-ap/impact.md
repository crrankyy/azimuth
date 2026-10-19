---
files:
  - path: src/core/placeholders.ts
    change: create
    note: Placeholder syntax, normalizePlaceholders, openPlaceholderScenarios, settleText, placeholderParts, settleLogBody, unreviewedSettles (no Node imports)
  - path: src/core/notes.ts
    change: create
    note: appendNoteText and addNote (locked, atomic write of notes.md)
  - path: src/core/settle.ts
    change: create
    note: settleValue writes stories.md and a log note in one locked step
  - path: src/cli/commands/note.ts
    change: create
    note: The note command (usage, --json, session touched)
  - path: src/cli/commands/settle.ts
    change: create
    note: The settle command (usage, --json, session touched)
  - path: src/cli/main.ts
    change: modify
    note: COMMANDS gains note and settle after log
  - path: src/core/spec-hash.ts
    change: modify
    note: specHash normalises placeholders in the stories part before hashing
  - path: src/core/types.ts
    change: modify
    note: FeatureDetail.notes
  - path: src/core/model.ts
    change: modify
    note: FeatureFiles.notes and FeatureEntity.notes, read in readFeatureFiles
  - path: src/core/build-index.ts
    change: modify
    note: featureDetail carries notes
  - path: src/core/gates.ts
    change: modify
    note: doneGate adds done.placeholders-settled after done.scenarios-passing
  - path: src/core/inbox.ts
    change: modify
    note: Feature review-auto items list values an agent settled; a new item for settles after review_ack_at, whoever approved the feature
  - path: src/core/transitions.ts
    change: modify
    note: acknowledge also accepts a feature with settles after review_ack_at; appendLogText, Who and Result are reused
  - path: src/core/delta.ts
    change: modify
    note: Acknowledging a feature you approved reads "acknowledged the values settled in F-…"
  - path: src/core/lock.ts
    change: read
    note: withLock and writeFileAtomic
  - path: src/core/session.ts
    change: read
    note: recordInSession adds the IDs to the session's touched list
  - path: src/core/parse/stories.ts
    change: read
    note: Unchanged; W-VAGUE already lets a placeholder THEN through, and fenced lines are skipped the same way
  - path: src/core/git.ts
    change: read
    note: hashAt and approvalChangesFor hash through specHash, so they follow the normalisation unchanged
  - path: src/core/derive.ts
    change: read
    note: modified_since_approval compares specHash with approved_hash, unchanged
  - path: src/cli/commands/write.ts
    change: read
    note: The log command and touch() are the pattern the new commands follow
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process for the command tests
  - path: test/helpers/project.ts
    change: read
    note: featureFiles and loadTree build the test projects
  - path: viewer/src/screens/feature/StoriesTab.tsx
    change: modify
    note: gwt renders settled values with a mark and open placeholders as "to be settled"
  - path: viewer/src/screens/feature/feature.css
    change: modify
    note: fd-ph, fd-ph-mark styles (muted open placeholder, settled mark)
  - path: viewer/src/screens/feature/AsBuiltTab.tsx
    change: modify
    note: Notes section, also before close-out
  - path: viewer/src/screens/feature/featureData.ts
    change: modify
    note: asBuiltOpen
  - path: viewer/src/screens/feature/FeatureDetail.tsx
    change: modify
    note: The As-built tab opens (and resolves) when asBuiltOpen is true
  - path: test/core/notes.test.ts
    change: test
    note: addNote, notes in the index, check and the approval ignore notes.md
  - path: test/cli/note.test.ts
    change: test
    note: azimuth note output, exit codes and session
  - path: test/core/placeholders.test.ts
    change: test
    note: Placeholder parsing, settleText and the spec hash
  - path: test/core/settle.test.ts
    change: test
    note: settleValue writes and the approval staying current
  - path: test/cli/settle.test.ts
    change: test
    note: azimuth settle output, exit codes and session
  - path: test/core/settle-gate.test.ts
    change: test
    note: done.placeholders-settled
  - path: test/core/settle-review.test.ts
    change: test
    note: Review items for values an agent settled, acknowledging them, and the delta wording
  - path: test/core/analysis.test.ts
    change: test
    note: The done-gate check list gains done.placeholders-settled
  - path: test/core/git-trace.test.ts
    change: test
    note: S-002.3.1 and S-002.3.2 list the new done check
  - path: test/fixtures/hookline/expected-index.ts
    change: test
    note: notes null in F-005's detail; the new passing check in F-007's next gate
  - path: viewer/src/screens/feature/AsBuiltTab.test.tsx
    change: test
    note: Notes in the As-built tab and asBuiltOpen
  - path: viewer/src/screens/feature/StoriesTab.test.tsx
    change: test
    note: Placeholder marks in ScenarioCard
  - path: plugin/skills/spec/SKILL.md
    change: modify
    note: Use {?} only for values the code will measure, never for behaviour
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: azimuth note for what a task taught, azimuth settle when a test proves a value, no reapprove after either
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: CLI reference rows for azimuth note and azimuth settle
  - path: src/core/protocol.ts
    change: modify
    note: Specs section on placeholders and notes.md
  - path: docs/cli.md
    change: modify
    note: note and settle commands; ack also acknowledges values an agent settled
  - path: docs/concepts.md
    change: modify
    note: Notes and placeholders vs approval, the done gate check, the Review item for settled values in every feature
  - path: docs/file-format.md
    change: modify
    note: notes.md, placeholder syntax in stories.md, spec hash normalisation, settle log entries
  - path: docs/viewer.md
    change: modify
    note: Notes in the As-built tab and placeholder marks in Stories
---
# F-008: Impact map

`placeholders.ts` holds every rule about `{?}` and `{=…}` as pure functions, so the hash
(`spec-hash.ts`), the settle command (`settle.ts`), the done gate (`gates.ts`), the inbox
(`inbox.ts`) and the viewer (`StoriesTab.tsx`) share one definition. Notes are a separate path:
`notes.ts` writes notes.md, `model.ts` reads it into the index, and the As-built tab shows it.
Review of settled values touches `inbox.ts`, `acknowledge` in `transitions.ts` and `delta.ts`,
which F-012 is also changing, so that one task waits for F-012's build. Nothing changes in
`write.ts` or the Inbox and Questions screens: the Review item and `azimuth ack` reach the
changed `acknowledge` as they are.
