---
id: F-008
title: Keep task notes and settled values out of the approval
summary: azimuth note writes what a task taught to the feature's notes.md, and azimuth settle fills a {?} placeholder in a THEN line with the value a test proved; neither makes the approval stale.
status: done
priority: P1
size: M
mode: brownfield
milestone: M-01
depends_on: []
superseded_by: null
tags: []
created: 2026-10-19
updated: 2026-10-19
approved_at: 2026-10-19
approved_by: agent
approved_hash: sha256:4b8907126dc6dedba7b9f27db28da672b2e4d4911f264b9b2ea03246da7be4cd
approved_commit: ad55c04
review_ack_at: null
---
# F-008: Keep task notes and settled values out of the approval

## Objective
Recording what a build taught must not cost a reapproval. Today each "Recorded during T-…"
bullet goes into feature.md, whose body `specHash` hashes whole, and each THEN value the code
proves wrong (byte offsets, counts) is a stories.md edit. Both make the approval stale
(`modified_since_approval`), so the orchestrator commits and reapproves after nearly every task
(experience report §4.3, §4.5, §5.4, §5.7 and §5.11).

This feature gives every feature a `notes.md` outside the spec hash, written by
`azimuth note <T-ID|F-ID> "<text>"`. A THEN or AND line may write a value as `{?}`: "the first
passing test settles it". `azimuth settle <S-ID> "<value>"` turns the scenario's first `{?}` into
`{=<value>}` and logs it, and `specHash` reads every `{=…}` as `{?}`, so settling never changes
the hash. The done gate waits until no `{?}` is left. Values an agent settles after you last
reviewed the feature appear in the inbox's Review list, whoever approved the spec, until you
acknowledge the feature. The viewer shows notes in the As-built tab and marks settled and open
values in the Stories tab.

## Out of scope
- Filling values in from test assertions (`azimuth trace --adopt` in report §5.7): the agent
  passes the value to `azimuth settle`, and nothing checks that a test proved it.
- Exempting sections of feature.md from the hash, and moving the existing "Recorded during"
  bullets to notes.md: feature.md keeps hashing whole, and existing features keep their bullets.
- Reading notes back into subagent briefs (F-009) or into `show --brief`.
- Placeholders in feature.md, impact.md, contract.md or plan.md. Only stories.md has them.
- Showing open placeholders before the done gate (`show --brief`, `next`, the verifying gate).
- Turning a settled value back into `{?}` from the CLI. That is a hand edit of stories.md.
- Editing notes in the viewer. notes.md can be edited by hand.
- An Acknowledge action for settled values on the feature page: the inbox's Review item carries
  it, as `azimuth ack` does.

## Integration points
- `src/core/placeholders.ts` (new, no Node imports, so the viewer can use it): the placeholder
  syntax, `normalizePlaceholders`, `openPlaceholderScenarios`, `settleText`, `placeholderParts`,
  `settleLogBody` and `unreviewedSettles`.
- `src/core/spec-hash.ts`: `specHash` passes the stories part through `normalizePlaceholders`
  before `normalize`. Its callers are unchanged: `derive` (`modified_since_approval`), `hashAt` in
  `git.ts` (`headSpecHash`, read by `approve.committed`), `approvalChangesFor`, and `moveFeature`
  and `reapproveFeature` in `transitions.ts` (`approved_hash`).
- `src/core/notes.ts` (new): `appendNoteText` and `addNote` (`withLock`, `writeFileAtomic`).
- `src/core/settle.ts` (new): `settleValue` writes stories.md and a log entry (`appendLogText`
  from `transitions.ts`) in one locked step.
- `src/cli/commands/note.ts` and `src/cli/commands/settle.ts` (new), registered in `COMMANDS` in
  `src/cli/main.ts`. Both add the IDs to the current session's `touched` with `recordInSession`,
  as `touch` in `write.ts` does.
- `src/core/model.ts` (`FeatureFiles.notes`, `FeatureEntity.notes`, read in `readFeatureFiles`),
  `src/core/types.ts` (`FeatureDetail.notes`) and `src/core/build-index.ts` (`featureDetail`).
- `src/core/gates.ts`: `doneGate` gets `done.placeholders-settled` between
  `done.scenarios-passing` and `done.as-built`.
- `src/core/inbox.ts`: while an automatic approval isn't acknowledged, its `review-auto` item
  lists the values an agent settled; otherwise, values an agent settled after `review_ack_at`
  (all of them while it is null) get their own `review-auto` item, for features approved by you
  or by an agent.
- `src/core/transitions.ts`: `acknowledge` also accepts a feature, whoever approved it, that has
  settle entries after its `review_ack_at`. A feature you approved with nothing to review is
  still refused, with today's message.
- `src/core/delta.ts`: acknowledging a feature you approved reaches agents as "acknowledged the
  values settled in F-…" instead of "acknowledged the automatic approval of F-…".
- F-012 is editing `transitions.ts`, `delta.ts` and `inbox.ts` (its T-012.2 to T-012.4). The
  task that changes them here (T-008.6) is built after F-012's build. This is an ordering between
  tasks of two features, not a `depends_on`.
- Viewer: `screens/feature/StoriesTab.tsx` (`gwt` renders placeholders), `feature.css`,
  `AsBuiltTab.tsx` (a Notes section), `featureData.ts` (`asBuiltOpen`) and `FeatureDetail.tsx`
  (the As-built tab opens when there are notes).
- Agent instructions and docs: `plugin/skills/spec/SKILL.md`, `plugin/skills/build/SKILL.md`,
  `plugin/skills/azimuth/SKILL.md` (CLI reference), `src/core/protocol.ts` (Specs section), `docs/cli.md`, `docs/concepts.md`,
  `docs/file-format.md` and `docs/viewer.md`.

## Invariants
- A spec without placeholders hashes exactly as before, so every `approved_hash` written so far
  stays valid. No stories.md in this repository or in the Hookline fixture contains `{?}` or `{=`.
- Adding or editing notes.md never changes the spec hash, and settling changes stories.md only by
  the placeholder it replaces. Every other edit to stories.md, feature.md, impact.md or
  contract.md still makes the approval stale.
- `settle` replaces exactly one `{?}` and leaves every other character of stories.md as it was,
  line endings included. A refused note or settle writes nothing.
- Every write goes through the project lock and an atomic rename. settle writes stories.md and
  log.md in the same locked step.
- The done gate's existing checks keep their IDs, rules, details and relative order.
- `acknowledge` keeps today's behaviour for agent-approved features and decisions, and keeps
  refusing a feature you approved that has nothing to review, with the message
  `<F-ID> has no automatic decision to acknowledge.`
- `src/core/placeholders.ts` imports no Node modules.
- The viewer never shows a placeholder's state by colour alone: a settled value carries a ✓ mark
  and the title "settled by test", and an open one reads "to be settled".
- The Hookline golden index changes only by `notes: null` in F-005's detail and the passing
  `done.placeholders-settled` check in F-007's next gate.

## Assumptions
- The fixed token the hash maps settled values to is `{?}` itself, and only the stories part is
  mapped. Placeholders exist only in stories.md, so other spec files (this feature's own
  feature.md and contract.md among them) can mention the syntax without it counting.
- A placeholder is `{?}`. A settled value is `{=`, a value of at least one character without
  `{`, `}` or line breaks, then `}`. `{=}` and other braces are plain text. `settle` trims the
  value and refuses an empty one or one with a brace or a line break.
- Placeholders count anywhere in a scenario's lines (from its heading to the next `## ` or `### `
  heading), inside or outside code spans, but not in fenced code blocks. A `{?}` outside every
  scenario is plain text for the done gate and for `settle`. The spec skill tells writers to use
  placeholders only in THEN and AND lines.
- Because the hash reads every settled value as `{?}`, changing a settled value by hand, or
  writing `{=…}` by hand, doesn't make the approval stale and leaves no log entry or Review item.
  `azimuth settle` is the recorded way.
- `review_ack_at` is the review cursor for settled values too. An approval or re-approval resets
  it to null, so settles from before it count again until you acknowledge the feature.
- A settle entry is a `note` log entry whose body is exactly `Settled <S-ID>: {=<value>}`. The
  inbox finds them by actor (`agent`) and body.
- `azimuth note` takes a feature or task ID only, and the task must be in the feature's plan.
  The section's date is the UTC date. The note goes to notes.md and to the session's `touched`
  list, not to the feature log.
- The index carries notes.md without its first `# ` title line, trimmed; null when the file is
  missing or holds nothing else. notes.md isn't parsed further, so hand edits are fine.
- `azimuth check` doesn't look for unexpected files in feature folders (`W-STRAY-FILE` only
  covers the single-file record folders, in `readRecords` in model.ts), so notes.md needs no
  exemption. A scenario guards that.
- The As-built tab opens as soon as a feature has notes instead of staying locked until
  close-out. Before close-out it shows the existing "As-built is written at close-out" line above
  the notes.
- The tests that list every done-gate check (`test/core/analysis.test.ts`, S-002.3.1 and
  S-002.3.2 in `test/core/git-trace.test.ts`, and the golden index) gain the new check. They
  aren't wrong; the gate changes.
- When the spec changed for another reason too, the start gate's detail and the reapprove item
  may also name commits that only settled values, since `approvalChangesFor` lists every commit
  that touched a spec file.
- F-008's own stories write the open placeholder as ⟦?⟧ and a value v settled as ⟦=v⟧. Written
  literally they would be live placeholders in this repository, and F-008's done gate would
  wait for them.
