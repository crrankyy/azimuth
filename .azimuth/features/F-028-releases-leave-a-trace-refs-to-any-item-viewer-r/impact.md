---
files:
  - path: src/core/types.ts
    change: modify
    note: Milestone gains tag and released_commit (nullable)
  - path: src/core/parse/records.ts
    change: modify
    note: parseMilestone reads tag and released_commit with r.nullable(r.text()) and lists them in unknownKeys
  - path: src/core/release.ts
    change: create
    note: releaseMilestone, isValidTagName, ReleaseOptions and ReleaseResult
  - path: src/core/git.ts
    change: modify
    note: tagCommit(root, tag), the short SHA of a tag's commit or null
  - path: src/core/transitions.ts
    change: modify
    note: checkExpected is exported for release.ts; moveMilestone is unchanged (F-026 changes the feature move path)
  - path: src/core/milestone-page.ts
    change: modify
    note: Created by F-026. MilestonePage gains commits; SECTIONS gains releaseSection and commitsSection after readinessSection
  - path: src/core/protocol.ts
    change: modify
    note: The commit bullet says a commit about a milestone or an issue names it; the only-the-user rule names azimuth release
  - path: src/core/init.ts
    change: modify
    note: The conventions template's Commits line names milestones and issues
  - path: src/cli/commands/write.ts
    change: modify
    note: The release command (usage, --tag, --json, the missing-tag hint on stderr), next to move
  - path: src/cli/main.ts
    change: modify
    note: Registers release after move (F-025 registers runs in the same table)
  - path: src/server/actions.ts
    change: modify
    note: The release action calls releaseMilestone as you with the status the user saw
  - path: viewer/src/screens/roadmap/release.ts
    change: create
    note: releaseOffer, releaseRequest, releaseLead, milestoneCommits, releasedLabel and MAX_LANE_COMMITS
  - path: viewer/src/screens/roadmap/Timeline.tsx
    change: modify
    note: Release… on a finished planned milestone, the release action, the released label and an expanded lane's commits
  - path: viewer/src/screens/roadmap/roadmap.css
    change: modify
    note: Styles for the rm-commit rows and the more line
  - path: test/fixtures/hookline/expected-index.ts
    change: modify
    note: Each milestone gains tag null and released_commit null
  - path: src/core/flows.ts
    change: read
    note: milestoneReady decides a planned milestone's offer; MILESTONE_FLOW stays as it is
  - path: src/core/ids.ts
    change: read
    note: MENTION_PATTERN already matches M-NN and BUG-NNNN, so commitRefs puts them in refs
  - path: src/core/derive.ts
    change: read
    note: RETIRED_STATUSES, the features milestoneProgress doesn't count
  - path: src/core/frontmatter.ts
    change: read
    note: updateFrontmatter edits keys in place and appends missing ones; inlineYaml quotes a digits-only SHA
  - path: src/core/schema.ts
    change: read
    note: r.text() reads a number as text; E-SCHEMA and W-UNKNOWN-KEY
  - path: src/core/build-index.ts
    change: read
    note: analyzeProject gives the model and facts.git.head; the index spreads each milestone record
  - path: src/core/session.ts
    change: read
    note: actorFromEnv gives the CLI's actor
  - path: src/core/templates.ts
    change: read
    note: The milestone template stays without tag and released_commit
  - path: src/core/next.ts
    change: read
    note: The release item's wording stays
  - path: viewer/src/components/Ui.tsx
    change: read
    note: useAction toasts the server's message for actions without a DONE title, release included
  - path: viewer/src/screens/issues/IssueDetail.tsx
    change: read
    note: The Issue page's CommitGroup, the pattern the milestone commits follow
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process, as the agent unless AZIMUTH_ACTOR is set
  - path: test/helpers/git.ts
    change: read
    note: initRepo, commitAll and git (for git tag)
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes features with extra milestone
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG
  - path: test/core/refs.test.ts
    change: test
    note: Refs naming a milestone or an issue, the protocol text, init --refresh and the conventions line (ST-028.1)
  - path: test/core/parse.test.ts
    change: test
    note: parseMilestone reads tag and released_commit (ST-028.2)
  - path: test/core/release.test.ts
    change: test
    note: releaseMilestone records and refusals (ST-028.3, ST-028.4)
  - path: test/cli/release.test.ts
    change: test
    note: azimuth release as you and as the agent, the hint, usage and --json (ST-028.5)
  - path: test/server/release-action.test.ts
    change: test
    note: runAction's release action and its 409 (S-028.6.7, S-028.6.8)
  - path: viewer/src/screens/roadmap/release.test.ts
    change: test
    note: releaseOffer, releaseRequest, releaseLead, milestoneCommits and releasedLabel
  - path: viewer/src/screens/roadmap/Timeline.test.tsx
    change: test
    note: The Roadmap's Release… control, released label and commit rows, rendered at #/roadmap
  - path: test/core/release-page.test.ts
    change: test
    note: The milestone page's release and commits sections (S-028.7.1 to S-028.7.4), apart from F-026's test/core/milestone-page.test.ts
  - path: docs/cli.md
    change: modify
    note: The release row in Change and a paragraph on --tag, released_commit and the hint
  - path: docs/concepts.md
    change: modify
    note: The milestone paragraph (release from planned or active, features done) and what a Refs ID links to, by kind
  - path: docs/file-format.md
    change: modify
    note: The Milestones section shows tag and released_commit and who writes them
  - path: docs/viewer.md
    change: modify
    note: The Roadmap row (commits naming a milestone) and the Release action row
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: The Commit bullet names milestones and issues; the only-the-user bullet names azimuth release
---
# F-028: Impact map

Four slices. The core release (`release.ts`, `git.ts`, the exported `checkExpected`) sits on
the new milestone fields (`types.ts`, `records.ts`, the fixture). The CLI command and the viewer
(`actions.ts`, the Roadmap) both call it. The milestone page and the Roadmap's commit rows read
the index only. The Refs slice changes only the protocol and the conventions template, since
`commitRefs` already links every ID kind.

`src/core/milestone-page.ts` is created by F-026, which this feature depends on, so
`W-IMPACT-MISSING` on it is expected until F-026 is built. The skills and docs change in the
last task.
