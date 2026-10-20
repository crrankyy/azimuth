---
id: F-022
title: Brief subagents on shared files, conventions and what to report
summary: azimuth brief adds the shared-file rules when a task lists a shared file, the project's conventions.md, and a closing request for lessons, files changed outside the list and proven placeholder values.
status: in-progress
priority: P1
size: S
mode: brownfield
milestone: M-02
depends_on: []
superseded_by: null
tags: []
created: 2026-10-20
updated: 2026-10-20
approved_at: 2026-10-20
approved_by: agent
approved_hash: sha256:687d011662672c48a39a4a9a90669427f9273067ee86ce33109d59b5c4886f56
approved_commit: 49dfb88
review_ack_at: null
---
# F-022: Brief subagents on shared files, conventions and what to report

## Objective
In the second ZenithMD run the orchestrator appended the same ~150 words to every one of 14 lane
prompts: the shared-file rules (one complete insertion, never touch another lane's insertion,
never run `cargo fmt` on the crate), the project's conventions, and a request to report what the
task taught and the values it proved (experience report §4.6 and §5.6). The records already hold
all of it, so `azimuth brief <T-ID>` (`taskBrief` in `src/core/task-brief.ts`) adds it:

- **Shared files.** When any of the task's `files` matches `parallel.shared_files`, the Rules
  name each such file and ask for one complete insertion to it (a whole enum variant, match arm,
  registry entry or module line), then forbid editing or reordering another task's insertion and
  running a formatter over a shared file or its package.
- **Conventions.** A `## Conventions` section holds the body of `.azimuth/project/conventions.md`,
  its headings one level deeper, as the Contract's are. It is left out while the file is missing,
  empty or still the template `azimuth init` wrote; above 1,500 words it is one line pointing to
  the file.
- **Closing request.** The last rule asks for the files changed, the verify result, what the task
  taught (for `azimuth note`), each file changed outside "Files you may change" and why, and,
  when a covered scenario holds an open placeholder, each value the tests proved as
  `<scenario ID>: <value>`. It replaces the old report rule, and the open-value rule keeps only
  its explanation, so no request is made twice.

The build skill stops telling the orchestrator to append these rules by hand; it still adds which
other tasks in the batch add to which shared file, which a single task's records don't hold.

## Out of scope
- Choosing the conventions.md sections a task touches (report §5.6): the brief holds the whole
  body or the pointer line.
- Naming the other tasks that list the same shared file, or the batch a task runs in: the brief
  is built from one task's records; the orchestrator adds that.
- The vision, architecture, glossary or the feature's objective in the brief.
- A config key for the 1,500-word limit, and recognising templates of earlier Azimuth versions.
- `task finish` (F-019's shared-file warning, `--adopt`), hunk staging and the early-finish rule
  (F-018).
- Writing notes or settling values from a subagent's report: the orchestrator runs
  `azimuth note` and `azimuth settle`.
- The `brief` command itself (`src/cli/commands/task.ts`): its usage, `--json` shape
  (`{task, feature, text}`) and exit codes stay as they are.
- Editing F-009's records, a done feature's: its contract's "Brief example" keeps the old rules
  as history.

## Integration points
- `src/core/task-brief.ts`: `taskBrief` adds the shared-file rules (`sharedFileRules`), the
  Conventions section (`conventionsBody`) and the closing request (`closingRule`). The heading
  demotion of `contractText` moves into `nestHeadings`, which the Contract and the Conventions
  sections share. `OPEN_RULE` drops its report clause and `STANDING_RULES` its last line, the
  old report rule.
- `src/core/glob.ts` (read): `globToRegExp` and `matchesAny`, matched against `files` as
  `parallelGroups` (`src/core/next.ts`) and `conflictProblems` (`src/core/validate.ts`) match
  `parallel.shared_files`. F-019 adds a helper to `glob.ts`; F-022 only reads it.
- `src/core/config.ts` (read): `Model.config.parallel.shared_files`.
- `src/core/model.ts` and `src/core/parse/knowledge.ts` (read): `Model.knowledge.conventions`,
  the `KnowledgeDoc` (`src/core/types.ts`) whose `body` is conventions.md without its
  frontmatter and title, trimmed (`parseDoc` with `stripTitle`), `""` when the file is missing,
  and whose `file` is `.azimuth/project/conventions.md`.
- `src/core/init.ts`: exports `CONVENTIONS_TEMPLATE`, the conventions.md text after the
  frontmatter that `projectDocs` writes, so the brief compares against the template `init`
  really writes. `init`'s output stays byte for byte the same.
- `test/core/task-brief.test.ts`: new tests per story; F-009's S-009.7.1 and S-009.7.2 assert
  the new last rules. `test/cli/task.test.ts` compares the CLI output with `taskBrief`'s, so it
  needs no change.
- Shared with other 0.3 features (each changes only its own part):
  - `docs/cli.md`: F-022 rewrites the `azimuth brief` paragraph under the Read table; F-018,
    F-019, F-021 and F-024 change other sections.
  - `plugin/skills/build/SKILL.md`: F-022 changes two bullets of "Delegating to subagents" (the
    hand-off and "Shared files take insertions only"). F-018 changes the batch-finish rule in the
    same section ("Parallel only when independent" and "Then finish the batch"), F-019 step 4's
    `not staged` and `--adopt` text, F-024 the plan.md and `--option` wording.

## Invariants
- `taskBrief` reads the model only: no git, no clock, no environment, no absolute paths. The same
  records give the same text, whatever the project's folder or the date (F-009).
- `azimuth brief` writes nothing.
- No line appears twice in the Rules, and `<scenario ID>: <value>` appears in at most one rule.
- A task that lists no shared file, in a project whose conventions.md is missing, empty or the
  template, gets F-009's brief with only its last rule changed: the closing request replaces
  "When you are done, report the files you changed and the verify command's result.", and with
  an open placeholder the open-value rule loses its report clause.
- The Scenarios, Contract, Invariants, Files, Verify and Notes sections keep their text.
- `azimuth init` writes the same conventions.md as before.

## Assumptions
- A task file is shared when `matchesAny(path, shared_files.map(globToRegExp))` holds for the
  path as written in `files`, the rule `parallelGroups` uses: no `./` or trailing-slash
  normalisation, and `*` doesn't cross `/`. One rule per such path, in `files` order, each path
  once; then the two general rules, once. A task with no shared file gets none of the three.
- The Rules, in order: the test-name rules, the four standing rules (unique names, tests first,
  only the listed files, no git or azimuth), the shared-file rules, the open-value rule when a
  covered scenario holds an open placeholder, and the closing request, always last.
- The closing request has the placeholder clause exactly when the open-value rule prints: a
  covered scenario holds an open placeholder outside fenced code (the `open` flag `scenarioText`
  already computes). Settled values alone add neither.
- The open-value rule keeps "make the test assert the value the code produces" and drops ", and
  report it as `<scenario ID>: <value>`", which moves to the closing request.
- The closing request says "what the task taught that later tasks should know (a constraint the
  code revealed, a choice the spec left open)", the build skill's wording for a note; it doesn't
  name `azimuth note`, since the subagent never runs azimuth.
- The Conventions section is left out when `knowledge.conventions.body` is `""` (no file, or only
  frontmatter and a title) or is the template: the body and `CONVENTIONS_TEMPLATE` without its
  title compare equal once each line loses its trailing whitespace and blank lines are dropped.
  So the `updated` date never counts, and a template Prettier gave blank lines after its headings
  is still the template. Any other edit makes it the project's conventions.
- Words are the body's whitespace-separated tokens, Markdown markers included. More than 1,500
  words gives the pointer line, naming `knowledge.conventions.file`; exactly 1,500 gives the body.
- The body nests under `## Conventions` by the Contract's rule: every heading line (`#` to
  `#####` and a space) outside fenced code one `#` deeper. The title is already gone
  (`stripTitle`), so `## Testing` prints as `### Testing`.
- The section comes after "Notes from earlier tasks" and before "Rules": the task's own records
  first, then how to work.
- F-022's stories write the open placeholder as ⟦?⟧ and a value v settled as ⟦=v⟧: written with
  braces they would be live placeholders in this repository. In the brief's text and in
  contract.md, ⟦?⟧ is the literal open placeholder.
- F-009's tests S-009.7.1 and S-009.7.2 change their expected last lines, because F-022 changes
  those rules by decision; their names and the rest of their expectations stay.
