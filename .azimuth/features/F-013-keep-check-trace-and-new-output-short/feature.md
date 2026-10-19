---
id: F-013
title: Keep check, trace and new output short
summary: check summarises warnings by code unless asked for them, trace hides mention-only rows, and new prints only the ID on stdout even when a later step fails.
status: done
priority: P2
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
approved_hash: sha256:5af8a6ab71b3721530aa08e9f70fb38f3ab108c1497d1faf2f3bd92e675983e7
approved_commit: d36d0f2
review_ack_at: 2026-10-19T20:29:08Z
---
# F-013: Keep check, trace and new output short

## Objective
Keep the three outputs an orchestrator reads dozens of times a day short (experience report §4.8
and §5.10). `azimuth check` lists every error but counts warnings by code on one line unless
`--warnings` or an ID asks for them, because 200 to 275 warnings on every run in a 73-feature
project trained the reader to skip to the last line. `azimuth trace` hides references that only
mention a scenario ID unless `--all`, because `(mention)` rows look like misses. `azimuth new`
prints only the new ID on stdout (the files go to stderr), and prints it even when a step after
creating the file fails, so chained creation can capture every ID with `$(…)`.

## Out of scope
- `verify --summary`: that is F-007.
- What the validator reports: no problem changes severity or disappears (W-FILE-CONFLICT stays).
- `--json` output of `check`, `trace` and `new`.
- The output of other commands (`move`, `log`, `session start`…), the viewer's problems panel and
  the problem counts in `status --brief`.
- Failures while writing a new record's own files (I/O errors such as a full disk): they fail as
  today.

## Integration points
- `src/cli/commands/read.ts`: `check` takes `--warnings` and summarises warnings by code without
  it; `trace` takes `--all` and counts the mention-only references it hides.
- `src/cli/commands/write.ts`: `newCommand` prints the ID (stdout) and the created files (stderr)
  right after creating them, then records the ID in the session (`recordInSession`).
- `src/core/create.ts`: `createDecision`, `createQuestion` and `createIssue` write their extra
  frontmatter fields (links, options, severity, files) with the file inside `allocateId` instead of
  patching the file afterwards; `patch()` goes.
- `src/cli/main.ts` (unchanged): its error handler reports a failure that follows the printed ID.
- `test/helpers/cli.ts`: runs the CLI in-process through `main()` for the new tests.
- `docs/cli.md`: the new options and outputs.

## Invariants
- `check` always lists every error in full; exit codes of `check`, `trace` and `new` don't change.
- `--json` output of all three is unchanged (`check --json` lists every problem, with or without
  `--warnings`).
- Text-mode `new` writes exactly one line to stdout, the ID, and only once its files exist.
- Every ID `new` uses is either printed on stdout or not used at all: a record whose fields can't
  be written leaves no file and doesn't advance the ID high-water mark.
- Problems, coverage and the index are computed as before; only the CLI's text changes.

## Assumptions
- The warning summary sits after the error entries, followed by an empty line and the totals line
  (`<E> errors, <W> warnings`, as today). Codes are ordered by count, most frequent first, ties by
  code (ascending). It is plain text, no colour.
- Counts aren't pluralised (`1 warnings`, `1 mention-only references hidden`), matching today's
  totals line (`1 errors, 0 warnings`).
- `check --warnings F-…` behaves like `check F-…`. A project without problems still prints
  `No problems.`.
- `trace` prints its hint once, as the last line, counting hidden reference lines across every
  scenario shown. With `--all` the mention rows keep today's ` (mention)` suffix. `trace --json`
  is unchanged and keeps mention-only references (with `confidence: "fallback"`).
- `new` prints the ID without colour. Its stderr line is `created ` followed by the paths joined
  with `, `; `new spec` that wrote no file prints `nothing new` instead. With `--json` it prints
  `{id, files}` (unchanged) and nothing on stderr; the JSON, like the ID, comes before recording in
  the session.
- A failure after the ID was printed is reported by `main()`'s existing handler: `✗ <message>` and
  exit 1 for Azimuth errors (such as `busy` from the session lock), `azimuth crashed: …` and exit 3
  otherwise. The ID and its file stay.
- The brief named two steps after file creation: `patch()` and `recordInSession`. Rather than print
  the ID of a record that is missing its links, files or severity, the fields are now written with
  the file, so a frontmatter failure (only possible with a project template whose frontmatter is
  invalid) creates nothing and uses no ID. `recordInSession` is the one step left after creation.
- Tests run the CLI in-process through `main()`, as `test/cli/options.test.ts` already imports CLI
  code, so they need no `pnpm build`. The session-recording failure is injected with `vi.mock`,
  because a real lock conflict can't be timed to fall between `allocateId` and `recordInSession`.
- No skill or protocol text changes: none shows the old `created:` line, skills run
  `check <ID>` (still a full listing), and the new hint lines name the flags that show more.
