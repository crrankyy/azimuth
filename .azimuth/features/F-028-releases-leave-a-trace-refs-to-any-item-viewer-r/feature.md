---
id: F-028
title: "Releases leave a trace: Refs to any item, viewer release and azimuth release"
summary: Refs may name a milestone or an issue and link the commit to it; the viewer releases a finished planned milestone (BUG-0084); a user-only azimuth release M-NN [--tag] records the tag and commit.
status: done
priority: P2
size: M
mode: brownfield
milestone: M-03
depends_on: [F-026]
superseded_by: null
tags: []
created: 2026-10-31
updated: 2026-10-31
approved_at: 2026-10-31
approved_by: agent
approved_hash: sha256:9fe5432a67f448c1fcd233cd38d995893451dbf6e0e2fd8bdbb3f0cf7df76126
approved_commit: 0935b31
review_ack_at: null
---
# F-028: Releases leave a trace: Refs to any item, viewer release and azimuth release

## Objective
The ZenithMD release session (2026-10-24) showed that a release leaves almost nothing behind in
Azimuth. This feature fixes three gaps:

- **Refs may name any item.** The protocol says a `Refs:` trailer names a task or feature. A
  release commit is about a milestone (ZenithMD's 3f915c1 used `Refs: M-04`), and a records-only
  commit may be about an issue (`Refs: BUG-0010`). Azimuth already parses every ID kind into a
  commit's `refs`, and the Issue page already lists commits naming the issue. Nothing shows
  commits naming a milestone. Now Refs may name any item, and the docs say what each kind links
  to. A milestone's commits appear on its `azimuth show M-NN` page and in its Roadmap row. The
  protocol and the conventions template say so.
- **The viewer releases a finished planned milestone (BUG-0084).** The Roadmap's Release…
  control showed only on an active milestone, and no control moves a milestone from planned to
  active. Both of this project's milestones went from planned to released without ever being
  active, so the user released them from a terminal. Now Release… shows on a planned milestone
  whose features are all done, and on any active one as before. Releasing a planned milestone
  passes through active in one step.
- **`azimuth release M-NN [--tag vX.Y.Z]` records the release.** A user-only command moves the
  milestone to released (through active when planned), sets `released_at`, and records `tag` and
  `released_commit` on the milestone. The viewer's Release records `released_commit` too. The
  milestone page and the Roadmap show both.

## Out of scope
- Creating, moving or pushing git tags. Azimuth only reads a tag that already exists.
- A tag field in the viewer's Release dialog. The viewer releases without a tag.
- `azimuth move M-NN released` and `azimuth move M-NN active`: they keep their rules and write
  what they write today.
- The milestone template (`src/core/templates.ts`) and `azimuth new milestone`: neither writes
  `tag` or `released_commit`.
- The wording of `azimuth next`'s release item ("Ask the user to release M-02 in the viewer")
  and of `W-MILESTONE-READY`. Both stay true once the viewer can release a planned milestone.
- Commits naming a milestone in `--json` output, the Overview, Activity or the Feature page.
- New warnings about Refs. No commit is warned about for the IDs it names.
- Reading commits beyond `git.log_depth` for a milestone. The page and the Roadmap use the
  index's commits, as the Issue page does.
- Rewriting `.azimuth/PROTOCOL.md` in existing projects. Each project runs
  `azimuth init --refresh` (an as-built follow-up).
- The rest of the milestone page (header, features by status, what keeps it from being ready),
  `show M-NN --brief` and a feature start moving its planned milestone to active: F-026 builds
  those.

## Integration points
- `src/core/release.ts` (new): `releaseMilestone(root, id, opts)` takes the project lock, reads
  the milestone and its features from `analyzeProject`, and writes `status: released`,
  `released_at`, `tag` and `released_commit` with `updateFrontmatter`. HEAD comes from
  `facts.git.head`; a tag's commit from a new `tagCommit` in `src/core/git.ts`. Both the server
  and the CLI call it.
- `src/core/transitions.ts`: `checkExpected` is exported so that `release.ts` refuses a stale
  viewer request with the same message. `moveMilestone` is unchanged. F-026 changes the feature
  move path in the same file; F-028 changes only the `export` keyword on `checkExpected`.
- `src/core/types.ts` and `src/core/parse/records.ts`: `Milestone` gains `tag` and
  `released_commit` (nullable); `parseMilestone` reads them and adds them to `unknownKeys`.
  `buildIndex` and `validate` spread the record, so they carry the fields unchanged.
- `src/core/git.ts`: `tagCommit(root, tag)` returns the 7-character SHA of the commit a tag
  points at, or null. `commitRefs` and `MENTION_PATTERN` (`src/core/ids.ts`) are unchanged: they
  already parse `M-NN` and `BUG-NNNN` into `refs`.
- `src/core/milestone-page.ts`, the milestone page module F-026 adds behind `show M-NN`:
  `MilestonePage` gains `commits` (the index's commits naming the milestone), and
  `formatMilestonePage`'s `SECTIONS` gains `releaseSection` (tag and released commit) and
  `commitsSection`, after F-026's `readinessSection`. One field and two section functions, as
  F-026 leaves room for; F-026's sections are unchanged. `showBrief` (`--brief`) is unchanged.
- `src/cli/commands/write.ts` and `src/cli/main.ts`: a `release` command next to `move`, using
  the file's `report` and `touch` helpers. F-025 registers `runs` in `main.ts`; F-028 adds only
  its own line.
- `src/server/actions.ts`: a `release` action calls `releaseMilestone` as you, with the status
  the user saw as `expectStatus`. The `move` action is unchanged.
- `viewer/src/screens/roadmap/release.ts` (new, no Node imports): when to offer Release, the
  request it sends, the dialog text, the released label and the commits naming a milestone.
  `Timeline.tsx` renders them. `milestoneReady` (`src/core/flows.ts`) decides a planned
  milestone's offer.
- `src/core/protocol.ts` renders `.azimuth/PROTOCOL.md`. `initProject` (`src/core/init.ts`)
  rewrites PROTOCOL.md and the templates on `--refresh`, but writes `project/conventions.md`
  only when it is missing. So the conventions line reaches new projects only. The CLAUDE.md and
  AGENTS.md blocks don't change.
- `test/fixtures/hookline/expected-index.ts`: each milestone gains `tag: null` and
  `released_commit: null`, so the golden index test and the viewer tests keep passing.
- Docs and skills: `docs/cli.md` (the `release` row and paragraph), `docs/concepts.md` (the
  milestone lifecycle paragraph and the commit links), `docs/file-format.md` (the Milestones
  section), `docs/viewer.md` (the Roadmap row and the Release action row) and
  `plugin/skills/azimuth/SKILL.md` (the Commit and Only-the-user bullets).

## Invariants
- Only the user releases a milestone. `releaseMilestone` refuses any other actor before it
  reads a file. The server acts as you, as it does for every action.
- A refused release writes nothing.
- A release writes only the milestone's file, and only the keys `status`, `released_at`, `tag`
  and `released_commit`. The body and every other key stay byte for byte.
- `azimuth release` and the viewer's Release follow the same rule, because both call
  `releaseMilestone`: a counted feature (not cancelled, not superseded) that isn't done blocks
  the release.
- Azimuth never runs `git tag`, `git push` or any git command that writes.
- `azimuth move M-NN <status>` keeps every rule and output it has today, `released` included.
- A milestone file without `tag` or `released_commit` parses as before, with both null and no
  problem.
- A commit's `refs` are what `commitRefs` returns today: the Refs trailer's IDs, else the IDs in
  the Conventional Commits scope.
- The Issue page's commits and History are unchanged.

## Assumptions
- Release requires every counted feature done, in the CLI and the viewer. The viewer already
  disabled Release on an active milestone with unfinished features, and `azimuth release`
  follows it. A milestone with no counted feature can be released. `azimuth move M-NN released`
  stays the unchecked path; it doesn't record a commit.
- `released_commit` is the tag's commit when `--tag` names a tag git has (`git rev-parse
  --verify --quiet --short=7 refs/tags/<tag>^{commit}`), else HEAD's 7-character SHA, else null
  outside git or before the first commit. A tag that doesn't exist yet is recorded as given. The
  CLI then prints a hint on stderr with the `git tag` command to run; it doesn't run it.
- A release writes both keys every time: `tag: null` without `--tag` (the viewer's Release
  included), `released_commit: null` without a commit. Keys missing from the file are appended at
  the end of the frontmatter in the order `released_at`, `tag`, `released_commit`, as
  `updateFrontmatter` does. A SHA of digits only is written quoted (`inlineYaml`), and the parser
  reads a number as text (`r.text()`), so `released_commit: 1234567` written by hand reads as
  `"1234567"`.
- The two keys are not added to the milestone template. A 0.3.0 reader warns `W-UNKNOWN-KEY` on a
  milestone released by 0.3.1. Nothing errors, so the release stays 0.3.1.
- A valid tag name starts with a letter or digit, holds only letters, digits and `.` `_` `+` `-`
  `/`, holds no `..` or `//`, and doesn't end with `.`, `/` or `.lock`. This is a subset of git's
  rules that every usual version tag passes. Anything else is refused before git is asked.
- Checks run in this order: the ID is a milestone; the actor is you; the tag name is valid; then,
  under the lock, the milestone exists, the status the viewer saw is current, it isn't released,
  and its counted features are done.
- The result message is `<M-ID>: active → released`, or `<M-ID>: planned → active → released`
  for a planned milestone, followed by ` (<tag> at <sha>)`, ` (<tag>)` or ` (at <sha>)` when
  those are known. The viewer's toast shows it, as it shows every move's message.
- Milestones have no log. The one-step pass through active leaves no other trace than the
  message; the file holds `status: released`.
- The viewer offers Release on an active milestone (disabled with `<n> features not done` while
  any counted feature isn't done, as today) and on a planned one only when `milestoneReady` is
  true. It offers nothing on an empty planned milestone, though the CLI can release it.
- The viewer's release request is the `release` action with no payload and `expect` set to the
  status shown. The `move` action with `to: released` keeps working for older pages.
- The milestone page gets two sections after F-026's. The release section holds `Tag: <tag>`
  and `Released commit: <sha>`, each only when set; F-026's header already shows the status and
  `released_at`. The commits section is `Commits naming <M-ID>:` and one line per commit,
  `  <sha> <date> <subject>`, newest first as the index lists them, at most 10, then
  `  … and <n> more`. No commit means no commits section. The date is the commit's UTC date.
- The Roadmap's released label is `Released <Mon D>`, then ` · <tag>` and ` · <sha>` when known.
  An expanded lane lists at most 5 commits naming the milestone (`<sha> <subject>`, the subject
  as a tooltip), then `and <n> more`. A collapsed lane shows only the label.
- The protocol's commit bullet becomes: a `Refs:` trailer names the task or feature
  (`Refs: T-005.2`); a commit about another item names that item instead, a release commit its
  milestone (`Refs: M-04`), a records-only commit its issue (`Refs: BUG-0010`). The ground rule
  on what only the user does names `azimuth release` and the viewer's Release.
- The conventions template's Commits line becomes `Conventional Commits with a \`Refs:\` trailer
  naming the task or feature, or the milestone or issue the commit is about.`
- PROTOCOL.md changes, so every project runs `azimuth init --refresh` after upgrading, this one
  included. The as-built's follow-ups say so.
- BUG-0084 is resolved by this feature. Its resolving move and commit name BUG-0084.
