---
files:
  - path: src/core/as-built.ts
    change: create
    note: filesChanged, deviationsFor, asBuiltText, asBuiltMessage and writeAsBuilt (load, refuse, read git, merge with the existing file, write under the lock)
  - path: src/cli/commands/as-built.ts
    change: create
    note: The as-built command (usage, F-ID check, runtime, recordInSession, message or --json)
  - path: src/cli/main.ts
    change: modify
    note: COMMANDS gains "as-built" after settle
  - path: src/core/git.ts
    change: modify
    note: readFeatureCommits and CommitChanges (whole history, name-status, no renames); commitRefs shared with readCommits
  - path: src/core/gates.ts
    change: modify
    note: done.as-built only (asBuiltCheck) - every deviation needs a non-blank reason; a file that doesn't parse fails
  - path: src/core/frontmatter.ts
    change: modify
    note: "inlineYaml takes an optional { padded } for the template's { path: …, change: … } item style"
  - path: src/core/create.ts
    change: modify
    note: template (the project's copy, else the built-in one) is exported for the as-built body
  - path: src/core/run-scope.ts
    change: modify
    note: repoPath is exported to normalise impact paths; inScope matches a changed path to a row
  - path: src/core/parse/feature.ts
    change: read
    note: parseAsBuilt (what the model reads back) and ImpactRaw
  - path: src/core/types.ts
    change: read
    note: AsBuilt, ImpactChange and Id; unchanged
  - path: src/core/templates.ts
    change: read
    note: TEMPLATES["feature/as-built.md"] and fill
  - path: src/core/model.ts
    change: read
    note: loadProject and FeatureEntity (status, dir, files.asBuilt, asBuilt, impact)
  - path: src/core/lock.ts
    change: read
    note: withLock and writeFileAtomic
  - path: src/core/ids.ts
    change: read
    note: featureOf, idKind and MENTION_PATTERN
  - path: src/core/derive.ts
    change: read
    note: commitsFor, the done gate's rule for which commits are a feature's, which as-built follows
  - path: src/core/notes.ts
    change: read
    note: The pattern for a locked write of one feature record (addNote)
  - path: src/core/errors.ts
    change: read
    note: AzimuthError codes invalid and not-found
  - path: src/core/session.ts
    change: read
    note: recordInSession adds the feature to the session's touched list
  - path: src/core/build-index.ts
    change: read
    note: analyzeProject gives the gate context the gate tests evaluate
  - path: src/cli/io.ts
    change: read
    note: runtime, print, printJson, requirePositional and UsageError
  - path: src/cli/commands/note.ts
    change: read
    note: The command shape as-built follows
  - path: test/helpers/git.ts
    change: read
    note: initRepo, commitAll and git (git mv) for repositories in temp folders
  - path: test/helpers/project.ts
    change: read
    note: featureFiles writes F-001 with its impact rows and status
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG
  - path: test/helpers/cli.ts
    change: read
    note: runCli runs the CLI in process
  - path: test/core/as-built.test.ts
    change: test
    note: filesChanged and deviationsFor rules; readFeatureCommits and writeAsBuilt against real git, reruns and refusals
  - path: test/core/as-built-gate.test.ts
    change: test
    note: done.as-built with blank, filled and missing reasons, no file and a file that doesn't parse
  - path: test/cli/as-built.test.ts
    change: test
    note: as-built output, --json, session, exit codes and refusal messages
  - path: plugin/skills/verify/SKILL.md
    change: modify
    note: Step 4 runs azimuth as-built, then has the agent write each reason, the Summary and the follow-ups
  - path: plugin/skills/azimuth/SKILL.md
    change: modify
    note: CLI table row for azimuth as-built
  - path: docs/cli.md
    change: modify
    note: Change table row and a paragraph (what it writes, reruns, output, refusals)
  - path: docs/file-format.md
    change: modify
    note: as-built.md - the draft command, change values, the deviation kinds, reruns and the done gate's reason rule
  - path: docs/concepts.md
    change: modify
    note: The verifying → done row - as-built.md exists with a reason for every deviation
---
# F-021: Impact map

One new core module, `as-built.ts`, computes the draft from pure functions and writes it with
the locked-write pattern of `notes.ts`. The only git it needs that `git.ts` doesn't already
give is a whole-history `git log --name-status --no-renames`, added there as
`readFeatureCommits` beside `readCommits`, whose refs rule both now share. Three existing core
files gain one export or option each (`run-scope.ts`, `create.ts`, `frontmatter.ts`); `gates.ts`
changes only the `done.as-built` check. The CLI gets one new command file and its `COMMANDS`
entry.
