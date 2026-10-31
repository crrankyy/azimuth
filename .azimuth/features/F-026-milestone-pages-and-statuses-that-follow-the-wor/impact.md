---
files:
  - path: src/core/transitions.ts
    change: modify
    note: moveFeature activates a planned milestone in the same save when a feature moves to in-progress (module-private milestoneActivation); moveMilestone is untouched
  - path: src/core/flows.ts
    change: modify
    note: STARTED_STATUSES, startedCount and milestoneStartedWhilePlanned next to milestoneReady
  - path: src/core/validate.ts
    change: modify
    note: milestoneProblems gives W-MILESTONE-READY or the new W-MILESTONE-PLANNED, never both
  - path: src/core/next.ts
    change: modify
    note: Only byPriority becomes exported, for the page; nextWork is unchanged
  - path: src/core/milestone-page.ts
    change: create
    note: milestonePage builds a milestone's page data, formatMilestonePage prints it from a list of section functions (F-028 adds two)
  - path: src/cli/commands/read.ts
    change: modify
    note: show prints the milestone page for a milestone ID without --brief (shared with F-025's runs and run handling)
  - path: src/core/brief.ts
    change: read
    note: showBrief's milestone line stays the --brief output (F-025 adds a run case)
  - path: src/core/derive.ts
    change: read
    note: milestoneProgress and RETIRED_STATUSES, the counts the warning and the page use
  - path: src/core/types.ts
    change: read
    note: Milestone, Feature, FeatureStatus, Priority, Index and Id
  - path: src/core/model.ts
    change: read
    note: Model and MilestoneRecord (with its file), which moveFeature's analyzeProject gives
  - path: src/core/frontmatter.ts
    change: read
    note: updateFrontmatter edits only the milestone's status line
  - path: src/core/gates.ts
    change: read
    note: The start gate (spec unchanged, dependencies done) that a refused move fails before any write
  - path: src/core/ids.ts
    change: read
    note: idKind tells a milestone ID for show
  - path: src/server/actions.ts
    change: read
    note: The viewer's move action calls move as you, so it reaches moveFeature unchanged
  - path: src/cli/commands/write.ts
    change: read
    note: azimuth move prints result.message, or the Result with --json
  - path: src/cli/main.ts
    change: read
    note: A UsageError prints its message and the usage line on stderr and exits 2
  - path: viewer/src/components/Ui.tsx
    change: read
    note: A move's toast title is the server's message, so it names the activation
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process as the agent
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes features with title, extra (milestone, priority, depends_on), tasks and ideaOnly; loadTree and makeFacts
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG for temp projects
  - path: test/core/milestone-ready.test.ts
    change: read
    note: F-023's milestone tests, the pattern for validate on a built index; they keep passing
  - path: test/core/milestone-activation.test.ts
    change: test
    note: moveFeature activates a planned milestone, leaves others alone, and writes nothing when refused
  - path: test/cli/milestone-activation.test.ts
    change: test
    note: azimuth move F-001 in-progress prints the activation and the milestone reads active
  - path: test/server/actions.test.ts
    change: test
    note: The viewer's move action activates the milestone; a stale expect writes nothing
  - path: test/core/milestone-planned.test.ts
    change: test
    note: W-MILESTONE-PLANNED from validate, startedCount and milestoneStartedWhilePlanned
  - path: test/core/milestone-page.test.ts
    change: test
    note: milestonePage's groups, blocking list and flags
  - path: test/cli/milestone.test.ts
    change: test
    note: check prints the warning; show M-NN prints the page, --brief and --json stay
  - path: docs/cli.md
    change: modify
    note: The show and move rows
  - path: docs/concepts.md
    change: modify
    note: The milestone paragraph says statuses follow the work and names W-MILESTONE-PLANNED
  - path: docs/file-format.md
    change: modify
    note: The Milestones section adds W-MILESTONE-PLANNED and the automatic move to active
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: One CLI row for azimuth show M-NN
---
# F-026: Impact map

Three slices. The warning lives in `flows.ts` and `validate.ts`.
The activation lives in `moveFeature` (`transitions.ts`) alone, since every feature move to
in-progress goes through it. The page is a new module, `milestone-page.ts`, printed by `show` in
`read.ts`.

`test/cli/milestone.test.ts` (F-023's) gains the CLI scenarios of the warning and the page;
its F-023 tests stay as they are. The other test files are new. The docs
and the skill change in the last task.
