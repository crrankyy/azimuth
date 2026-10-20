---
name: spec
description: Write the full spec for an Azimuth feature (context, impact map, BDD stories, contract, task plan), resolve ambiguities as questions, and move it to draft and, when the project allows it, approved.
argument-hint: "<F-NNN> (or a new feature request)"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
  - Bash(git *)
---

# Spec a feature

Target: $ARGUMENTS

!`${CLAUDE_PLUGIN_ROOT}/bin/azimuth status --brief`

You are a principal architect writing a deterministic spec before any implementation. Don't
write implementation code in this skill.

## 1. Ground yourself

- If the argument is a request rather than an ID, capture it first with
  `azimuth new feature "<title>" --summary "…"`.
- `azimuth session start --skill spec --goal "Spec <F-ID>" --touch <F-ID>`.
- `azimuth show <F-ID> --brief` (address any change requests it lists).
- Read `.azimuth/project/architecture.md`, `conventions.md` and `glossary.md`, and the specs of
  features this one depends on or touches (`azimuth show F-… --brief`).
- Inspect the code the feature will touch: modules, types, error idioms, test runner.

## 2. Ambiguity gate

For each decision that is unstated, can't be inferred from the code, and is costly to reverse,
raise a question instead of guessing:

```
azimuth new question "<question>" --feature <F-ID> --blocking \
  --option a="<label>: <trade-off>" --option b="<label>: <trade-off>" --recommend a \
  --context "<why the code can't answer it>"
```

Use `--blocking` only when the answer changes stories or the contract. Record smaller,
reversible choices as assumptions in feature.md. Keep writing the parts that don't depend on
open questions.

If the Autonomy line of the status above says `questions proceed`, raise each smaller choice
as a non-blocking question with `--recommend` (no `--blocking`) instead of only writing the
assumption. The CLI answers it with your recommendation at once and says so on stderr. Proceed
with it: write the assumption into feature.md and record it with
`azimuth resolve Q-NNNN --assumption <F-ID>`. The user can answer it differently in the viewer;
that answer then reaches you like any other. Under `questions ask`, only the user answers.

## 3. Write the spec (in this order)

Run `azimuth new spec <F-ID>` to scaffold missing files, then replace the placeholders:

1. **feature.md**: `summary`, `size` (S ≤ 3 tasks, M 4–8, L 9–15; split XL), `depends_on`,
   and the sections Objective, Out of scope, Integration points, Invariants, Assumptions.
2. **impact.md**: every file to create, modify, read or test, each with a one-line note.
   Paths must sit under modules from architecture.md.
3. **stories.md**: stories with an intent line, and scenarios
   `### S-NNN.n.m · <title> {happy|negative|edge}` with exactly one GIVEN, WHEN and THEN
   (AND lines allowed). Every story needs a happy scenario and a negative or edge scenario.
   THEN names the exact value, state, error variant or status code, never "is handled".
   Use `{?}` only for a value the code will measure (a byte offset, a count, a size): write it
   in a THEN or AND line, and the build settles it with the value the first passing test proves
   (`azimuth settle`) without making the approval stale. Never use `{?}` for behaviour you
   haven't decided; that is a question or an assumption. The feature can't be done while a `{?}`
   is left.
4. **contract.md**: data structures, public signatures, errors and (if stateful) a
   `stateDiagram-v2` block, in the target language, without function bodies.
5. **plan.md**: a task graph in test-first order: types and scaffolding, then one task per
   story slice that writes its tests first and then the implementation, then wiring and full
   verification. Each task lists `after`, `covers` (scenario IDs), `files` and a `verify`
   command that exits 0 on success; a task that covers scenarios verifies by running their
   tests with output that shows which tests ran (a typecheck alone proves none of them; use
   `vitest run --reporter=verbose` and `go test -v`: plain Vitest output outside a terminal and
   plain `go test` name no tests). Don't split a slice into a "red tests" task:
   its verify could only pass by not running the tests. Every scenario must be covered by a task.

   Shape the graph so slices can be built at the same time, for example by subagents: give
   each slice its own files (a module per slice rather than one shared file) and make it
   depend only on what it needs, usually the scaffolding. Two tasks may list the same file
   only if one comes `after` the other, unless the file matches `parallel.shared_files` in
   config.yaml: a registry such as an enum and its dispatch, which each task extends with one
   complete insertion. `files` lists every file the task creates or changes, since builders
   decide what can run in parallel from it.

## 4. Check, draft, commit, approve

1. `azimuth check <F-ID>` until it reports no errors (warnings: fix unless deliberate). It
   applies the story rule to the idea already (`W-NO-NEGATIVE`), so it catches here a story the
   approval gate would refuse.
2. `azimuth move <F-ID> draft`, then `azimuth check <F-ID>` again for the draft's hints.
   `W-MEASURED`: if only the code can measure the value, write it as `{?}` (section 3);
   otherwise keep it. `W-NO-COVERS`: give the task the scenarios it makes pass; a task that only
   scaffolds or wires may keep it, and a task whose files are all Markdown never gets it. Hints
   don't count toward `autonomy.strict`.
3. Commit the spec: `docs(<F-ID>): spec <title>` with `Refs: <F-ID>`.
4. If no blocking question is open, run `azimuth move <F-ID> approved`. The CLI approves it when
   every gate check passes and the project allows automatic approval. If it refuses because
   approval is manual, tell the user the spec is ready for them in the viewer. If a gate check
   fails, fix it and retry.

## 5. Hand off

`azimuth session handoff "<what's next: open questions, approval state, suggested /azimuth:build>"`.
Leave the session open: the plugin closes it when the Claude Code session ends, and a later skill
in this Claude Code session continues it. Report the feature's state and any questions waiting for
the user.
