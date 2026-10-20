---
files:
  - path: src/core/parse/stories.ts
    change: modify
    note: ScenarioRaw.thenLines (the THEN line and the AND lines after it, with line numbers) and the pure measuredValue
  - path: src/core/validate.ts
    change: modify
    note: Story rule for ideas, W-MEASURED and W-NO-COVERS in drafts, milestoneProblems (W-MILESTONE-READY), HINT_CODES and isHint
  - path: src/core/gates.ts
    change: modify
    note: Only approveGate's autonomy.strict check, which leaves hints out of its warning count
  - path: src/core/derive.ts
    change: modify
    note: milestoneReady next to milestoneProgress
  - path: src/core/next.ts
    change: modify
    note: releaseItems, added to nextWork after critical issues and before feature work
  - path: src/core/init.ts
    change: modify
    note: The config template's strict comment says hints aside
  - path: src/core/types.ts
    change: modify
    note: AutonomyConfig.strict's doc comment says hints aside
  - path: src/core/placeholders.ts
    change: read
    note: placeholderParts splits a line into plain text, open and settled placeholders
  - path: src/core/parse/common.ts
    change: read
    note: problem() builds each new warning; a W- code makes it a warning
  - path: src/core/model.ts
    change: read
    note: FeatureEntity (status, stories, tasks, files) and the milestone records in the model
  - path: src/core/parse/records.ts
    change: read
    note: MilestoneRecord (status planned, active or released; no feature list of its own)
  - path: src/core/build-index.ts
    change: read
    note: Index milestones carry milestoneProgress; scenarios are mapped field by field, so thenLines stays out of the index
  - path: src/core/brief.ts
    change: read
    note: statusBrief shows the first five nextWork items, release items included
  - path: src/cli/commands/read.ts
    change: read
    note: check (relatedTo, warning counts) and next print the new warnings and items unchanged
  - path: src/core/transitions.ts
    change: read
    note: moveMilestone lets only the user release; moveTask clears a task's note on moves
  - path: src/core/flows.ts
    change: read
    note: MILESTONE_FLOW planned → active → released
  - path: test/helpers/project.ts
    change: read
    note: featureFiles (stories, tasks, impact, milestone via extra), loadTree and makeFacts
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process
  - path: test/core/measured.test.ts
    change: test
    note: measuredValue on the decided examples and non-triggers; thenLines from parseStories
  - path: test/core/check-hints.test.ts
    change: test
    note: W-NO-NEGATIVE for ideas, W-MEASURED and W-NO-COVERS in drafts only, Markdown-only tasks skipped
  - path: test/core/strict-hints.test.ts
    change: test
    note: HINT_CODES; strict approval passes with only hints and fails with another warning
  - path: test/core/milestone-ready.test.ts
    change: test
    note: W-MILESTONE-READY, milestoneReady and the release item in nextWork and statusBrief
  - path: test/cli/milestone.test.ts
    change: test
    note: check M-01 and next print the milestone warning and the release item
  - path: test/cli/check.test.ts
    change: test
    note: check F-072 on an idea; one W-NO-COVERS summary; the S-013.1 project's T-001.2 covers S-001.1.1
  - path: test/core/analysis.test.ts
    change: test
    note: The drift-and-coverage validate test gains W-NO-COVERS T-002.1
  - path: test/golden/index.test.ts
    change: test
    note: Deviation for the W-NO-COVERS hints of five Hookline draft tasks
  - path: docs/file-format.md
    change: modify
    note: Story rule from idea on, W-MEASURED (stories), W-NO-COVERS (plan), W-MILESTONE-READY (milestones), strict comment
  - path: docs/concepts.md
    change: modify
    note: Hints and strict (gate table, autonomy, problems), milestones and the release item
  - path: docs/cli.md
    change: modify
    note: The azimuth next row names release items after critical issues
  - path: plugin/skills/spec/SKILL.md
    change: modify
    note: check before move draft catches the story rule; draft hints, W-MEASURED means write {?}
---
# F-023: Impact map

All the logic is in core. The parser records each scenario's THEN and later AND lines, and
`validate.ts` turns them into `W-MEASURED`. It also adds the idea story rule, `W-NO-COVERS` and
`W-MILESTONE-READY`. `gates.ts` changes one filter, `derive.ts` gains one predicate, and
`next.ts` gains one item builder. The CLI prints the new warnings and items unchanged, so
`read.ts` and `brief.ts` are only read.

Three existing tests change because what they pin changes: a draft task covering nothing now
gets a hint. Each change is named in feature.md's assumptions.
