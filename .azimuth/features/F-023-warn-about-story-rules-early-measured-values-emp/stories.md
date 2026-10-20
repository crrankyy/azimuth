# F-023: Stories

Notation: in this file ⟦?⟧ stands for the open placeholder (an opening brace, a question mark and
a closing brace) and ⟦=v⟧ for the value v settled (an opening brace, an equals sign, v and a
closing brace); tests write the real characters. Written literally here they would be live
placeholders in this repository's own stories.

Unless a scenario says otherwise, a project is a temp folder holding `.azimuth/config.yaml` with
`MINIMAL_CONFIG` (no architecture modules) and features written with `featureFiles` (folder
`.azimuth/features/F-NNN-thing/`, the scenario kinds a story lists, THEN `c = 1`, and tasks with
verify `pnpm test`). Core scenarios run `validate(model, facts, derive(model, facts))` with
`makeFacts()`, whose `exists` is always true. "The feature's warnings" are the problems
`approveGate` counts for it: its file is in the feature's folder, or its ref is the feature or
one of its stories, scenarios or tasks. CLI scenarios run with `runCli`, so `NO_COLOR=1` and
`AZIMUTH_ACTOR=agent`; such a project also holds `src/app.ts`.

**Fixture A** is this stories.md for F-001, line numbers on the left:

```markdown
 1 ## ST-001.1 · Spans
 2 **Intent:** As an editor, I want bold spans found so that they render bold.
 3
 4 ### S-001.1.1 · A bold span {happy}
 5 - **GIVEN** the text `a **b**`
 6 - **AND** the caret at offset 3
 7 - **WHEN** it is parsed
 8 - **THEN** the bold token spans range `9..12`
 9 - **AND** the view reports caret: 24
10 - **AND** the error list is empty
11
12 ### S-001.1.2 · Plain text {edge}
13 - **GIVEN** the text `ab`
14 - **WHEN** it is parsed
15 - **THEN** the output is byte-for-byte equal to the input
```

## ST-023.1 · check applies the story rule to an idea with stories
**Intent:** As an orchestrator, I want `azimuth check` to report a story without a negative or edge scenario while the feature is still an idea, so that the approval gate's story rule doesn't surprise me after the draft move.

### S-023.1.1 · check on an idea names the incomplete story {happy}
- **GIVEN** a project whose only feature F-072 (idea, slug `thing`) has stories.md with story ST-072.1 holding one happy scenario S-072.1.1, covered by task T-072.1
- **WHEN** `azimuth check F-072` runs
- **THEN** stdout is exactly `W-NO-NEGATIVE .azimuth/features/F-072-thing/stories.md:1 ST-072.1\n  ST-072.1 needs at least one happy and one negative or edge scenario.\n\n0 errors, 1 warnings\n` and the exit code is 0

### S-023.1.2 · Nothing else is checked for an idea {edge}
- **GIVEN** F-072 (idea) with story ST-072.1 holding one happy scenario, task T-072.1 with `covers: []`, an impact entry `lib/x.ts` with change `create`, and `.azimuth/project/architecture.md` whose only module has path `src`
- **WHEN** `validate` runs
- **THEN** it returns exactly one problem: `{ code: "W-NO-NEGATIVE", severity: "warning", file: ".azimuth/features/F-072-thing/stories.md", line: 1, ref: "ST-072.1", message: "ST-072.1 needs at least one happy and one negative or edge scenario." }`
- **AND** no `W-UNCOVERED-SCENARIO`, `E-UNCOVERED-SCENARIO`, `W-PATH` or `W-NO-COVERS` is among the problems

### S-023.1.3 · Complete stories and missing stories give an idea no warning {negative}
- **GIVEN** F-072 (idea) whose story ST-072.1 holds a happy and a negative scenario, and F-073 (idea) with only feature.md and log.md
- **WHEN** `validate` runs
- **THEN** it returns `[]`

## ST-023.2 · A draft's THEN hints at a measured value
**Intent:** As a spec writer, I want check to point at a THEN value that looks like a byte range or an offset while the feature is a draft, so that I write ⟦?⟧ instead of a guess the build will correct with a reapprove.

### S-023.2.1 · The decided examples match {happy}
- **GIVEN** the lines `` the bold token spans range `9..12` ``, `` the parse error is `Unclosed { offset: Some(63) }` ``, `the view reports caret: 24`, ``the span `byte_range: 34..39` is highlighted``, ``lines `2..=5` are folded`` and `the cursor has position = 7`
- **WHEN** `measuredValue` runs on each line
- **THEN** it returns `9..12`, `offset: Some(63)`, `caret: 24`, `byte_range: 34..39`, `2..=5` and `position = 7`, in that order

### S-023.2.2 · Placeholders, byte-for-byte, function names and dotted numbers don't match {negative}
- **GIVEN** the lines `the output is byte-for-byte equal to the input`, `` the bold token spans range `⟦=9..12⟧` ``, `` the parse error has `offset: ⟦?⟧` ``, `it ends at byte ⟦=30⟧`, ``the call `byte_to_char(5)` returns 2`` and ``version `0.3.0` passes S-023.1.1``
- **WHEN** `measuredValue` runs on each line
- **THEN** it returns `null` for every line

### S-023.2.3 · The parser keeps the THEN line and the AND lines after it {edge}
- **GIVEN** Fixture A (top of F-023's stories.md)
- **WHEN** `parseStories(text, "stories.md", "F-001")` runs
- **THEN** S-001.1.1's `thenLines` is ``[{ text: "the bold token spans range `9..12`", line: 8 }, { text: "the view reports caret: 24", line: 9 }, { text: "the error list is empty", line: 10 }]`` and S-001.1.2's is `[{ text: "the output is byte-for-byte equal to the input", line: 15 }]`
- **AND** S-001.1.1's `then` is still ``the bold token spans range `9..12` and the view reports caret: 24 and the error list is empty``

### S-023.2.4 · A draft gets one W-MEASURED per matching line {happy}
- **GIVEN** F-001 (draft) with Fixture A (top of F-023's stories.md) as stories.md and task T-001.1 covering S-001.1.1 and S-001.1.2
- **WHEN** `validate` runs
- **THEN** its `W-MEASURED` problems are exactly `{ code: "W-MEASURED", severity: "warning", file: ".azimuth/features/F-001-thing/stories.md", line: 8, ref: "S-001.1.1", message: "\"9..12\" looks like a value only the code can measure. If it is, write ⟦?⟧ instead: the first passing test settles it." }` and the same at line 9 with the message `"caret: 24" looks like a value only the code can measure. If it is, write ⟦?⟧ instead: the first passing test settles it.`, in that order
- **AND** no problem has line 6 or line 15

### S-023.2.5 · No W-MEASURED outside draft {negative}
- **GIVEN** three projects, each with F-001 holding Fixture A (top of F-023's stories.md) and task T-001.1 covering S-001.1.1 and S-001.1.2, at status idea, approved and in-progress
- **WHEN** `validate` runs for each
- **THEN** none of the three results holds a problem with code `W-MEASURED`

## ST-023.3 · A draft's task that covers nothing gets a hint
**Intent:** As a spec writer, I want check to point at a task that covers no scenario while the feature is a draft, so that a task meant to make scenarios pass doesn't reach a lane without a THEN to hold it to.

### S-023.3.1 · A draft task without covers {happy}
- **GIVEN** F-001 (draft) with story ST-001.1 (happy, negative), task T-001.1 covering S-001.1.1 and S-001.1.2, and task T-001.2 with `covers: []` and no `files`
- **WHEN** `validate` runs
- **THEN** it returns exactly `[{ code: "W-NO-COVERS", severity: "warning", file: ".azimuth/features/F-001-thing/plan.md", line: null, ref: "T-001.2", message: "T-001.2 covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents." }]`

### S-023.3.2 · No W-NO-COVERS outside draft {negative}
- **GIVEN** the tasks of S-023.3.1 in three projects whose F-001 is idea, approved and in-progress
- **WHEN** `validate` runs for each
- **THEN** none of the three results holds a problem with code `W-NO-COVERS`

### S-023.3.3 · check counts the hint like any warning {edge}
- **GIVEN** a project with `src/app.ts` and the F-001 of S-023.3.1
- **WHEN** `azimuth check` runs
- **THEN** stdout is exactly `1 warnings: 1 W-NO-COVERS (--warnings lists them)\n\n0 errors, 1 warnings\n` and the exit code is 0

### S-023.3.4 · A task whose files are all Markdown gets no hint {edge}
- **GIVEN** F-001 (draft) with story ST-001.1 (happy, negative), task T-001.1 covering S-001.1.1 and S-001.1.2, task T-001.2 with `covers: []` and `files: [docs/guide.md, plugin/skills/spec/SKILL.md]`, and task T-001.3 with `covers: []` and `files: [docs/cli.md, src/core/init.ts]`
- **WHEN** `validate` runs
- **THEN** it returns exactly `[{ code: "W-NO-COVERS", severity: "warning", file: ".azimuth/features/F-001-thing/plan.md", line: null, ref: "T-001.3", message: "T-001.3 covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents." }]`

## ST-023.4 · Hints don't count toward strict approval
**Intent:** As a user who set `autonomy.strict`, I want the zero-warning approval check to ignore hints, so that a legitimate spec with a scaffolding task or a decided offset can still be approved.

### S-023.4.1 · Only hints: strict approval passes {happy}
- **GIVEN** config `MINIMAL_CONFIG` plus `autonomy:\n  strict: true\n`, F-001 (draft) with Fixture A (top of F-023's stories.md), task T-001.1 covering S-001.1.1 and S-001.1.2 and task T-001.2 with `covers: []`, and facts whose git is available with F-001's committed spec hash equal to its current one
- **WHEN** `nextGate` runs for F-001 on the problems of `model.problems` and `validate`, sorted
- **THEN** the feature's warnings are exactly `W-MEASURED S-001.1.1` (line 8), `W-MEASURED S-001.1.1` (line 9) and `W-NO-COVERS T-001.2`, and every check of the gate to `approved` passes, the last being `{ id: "approve.no-warnings", rule: "No warnings in this feature", ok: true }`

### S-023.4.2 · Another warning still blocks strict approval {negative}
- **GIVEN** the project of S-023.4.1 with line 15 of Fixture A changed to `- **THEN** it works correctly`
- **WHEN** `nextGate` runs for F-001
- **THEN** the only failing check is `{ id: "approve.no-warnings", rule: "No warnings in this feature", ok: false, detail: "1 warning" }`

### S-023.4.3 · Hints are one list of codes {edge}
- **GIVEN** `HINT_CODES` and `isHint` from `src/core/validate.ts`
- **WHEN** `isHint` runs on problems coded `W-MEASURED`, `W-NO-COVERS`, `W-NO-NEGATIVE`, `W-VAGUE` and `W-MILESTONE-READY`
- **THEN** `HINT_CODES` equals `["W-MEASURED", "W-NO-COVERS"]` and the results are `true`, `true`, `false`, `false` and `false`

## ST-023.5 · check warns about a milestone whose features are all done
**Intent:** As a user, I want check to say when every feature of a planned or active milestone is done, so that the milestone gets released and the viewer's phase is right.

### S-023.5.1 · Planned and active milestones ready for release {happy}
- **GIVEN** `.azimuth/milestones/M-01-first.md` (`id: M-01`, `title: First`, `status: planned`) with F-001 and F-002 done, and `.azimuth/milestones/M-02-second.md` (`id: M-02`, `title: Second`, `status: active`) with F-003 done and F-004 cancelled, each feature naming its milestone in `milestone`
- **WHEN** `validate` runs
- **THEN** its `W-MILESTONE-READY` problems are exactly `{ code: "W-MILESTONE-READY", severity: "warning", file: ".azimuth/milestones/M-01-first.md", line: null, ref: "M-01", message: "Every feature of M-01 is done but it is still planned; ask the user to release it." }` and `{ code: "W-MILESTONE-READY", severity: "warning", file: ".azimuth/milestones/M-02-second.md", line: null, ref: "M-02", message: "Every feature of M-02 is done but it is still active; ask the user to release it." }`, in that order

### S-023.5.2 · A milestone with an unfinished feature {negative}
- **GIVEN** M-01 (planned) with F-001 done and F-002 in progress, and M-02 (active) with F-003 done and F-004 deferred
- **WHEN** `validate` runs
- **THEN** no problem has code `W-MILESTONE-READY`, and `milestoneReady` is false for both milestones of the built index

### S-023.5.3 · Released, empty and retired-only milestones {edge}
- **GIVEN** M-01 (`status: released`, `released_at: 2026-10-01`) with F-001 done, M-02 (planned) that no feature names, and M-03 (planned) whose only feature F-004 is cancelled
- **WHEN** `validate` runs
- **THEN** no problem has code `W-MILESTONE-READY`, and `milestoneReady` is false for all three milestones of the built index

### S-023.5.4 · check on the milestone prints the warning {happy}
- **GIVEN** a project with `src/app.ts`, M-01 (`title: First`, planned) and F-001 and F-002 done with `milestone: M-01`
- **WHEN** `azimuth check M-01` runs
- **THEN** stdout is exactly `W-MILESTONE-READY .azimuth/milestones/M-01-first.md M-01\n  Every feature of M-01 is done but it is still planned; ask the user to release it.\n\n0 errors, 1 warnings\n` and the exit code is 0

## ST-023.6 · next asks the agent to have the user release a ready milestone
**Intent:** As an orchestrator, I want `azimuth next` to tell me when a milestone waits for its release, so that I ask the user, the only one who can release it.

### S-023.6.1 · The release item follows critical issues and leads feature work {happy}
- **GIVEN** the open critical bug BUG-0001 (`.azimuth/issues/BUG-0001-crash.md`), M-01 (`title: First`, planned) with F-001 done, and F-002 in progress with no milestone and one todo task T-002.1 covering its two scenarios
- **WHEN** `nextWork(index)` runs on the built index
- **THEN** the items' refs are `["BUG-0001", "M-01", "T-002.1"]` and the second item is `{ ref: "M-01", title: "First", action: "Ask the user to release M-01 in the viewer", reason: "Every feature is done; only the user releases a milestone" }`
- **AND** `statusBrief(index)` contains the line `  M-01 Ask the user to release M-01 in the viewer — Every feature is done; only the user releases a milestone`

### S-023.6.2 · azimuth next prints the release item {happy}
- **GIVEN** the project of S-023.5.4
- **WHEN** `azimuth next` runs
- **THEN** stdout is exactly `M-01 Ask the user to release M-01 in the viewer\n  Every feature is done; only the user releases a milestone\n` and the exit code is 0
- **AND** the stdout of `azimuth next --json` parses to `[{ "ref": "M-01", "title": "First", "action": "Ask the user to release M-01 in the viewer", "reason": "Every feature is done; only the user releases a milestone" }]`

### S-023.6.3 · No item for a milestone that isn't ready, nor in next for one feature {negative}
- **GIVEN** a project with `src/app.ts` and the milestones and features of S-023.5.2, and separately the project of S-023.5.4
- **WHEN** `azimuth next --json` runs on the first project and `azimuth next F-001` on the second
- **THEN** the first prints a JSON list in which no item's `ref` starts with `M-`, and both exit 0
- **AND** `azimuth next F-001` prints exactly `Nothing to do: no unblocked work.\n`
