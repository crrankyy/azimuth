# F-022: Stories

"The example project" is F-009's brief example as `test/core/task-brief.test.ts` builds it
(`exampleFiles()`): MINIMAL_CONFIG with `stack.languages: [typescript]` and no `parallel` key,
and F-001 "Parse headings" in `.azimuth/features/F-001-thing/` with one invariant, stories
S-001.1.1 to S-001.1.3 without placeholders, a contract and a notes.md whose last line is
`Heading levels are 1-based.`. Its T-001.2 comes after T-001.1 (done), covers S-001.1.1 and
S-001.1.2, and has `files: [src/headings.ts, test/headings.test.ts]`. It has no
`.azimuth/project/conventions.md`. "The Rules" are the lines after `## Rules` and a blank line.
Every WHEN runs `taskBrief(loadProject(root), "T-001.2")` unless it says otherwise.

## ST-022.1 · A task that lists a shared file gets the insertion rules
**Intent:** As an orchestrator, I want the brief of a task that lists a shared file to carry the insertion rules, so that I stop appending them to every lane's prompt by hand.

### S-022.1.1 · A listed shared file is named in the rules {happy}
- **GIVEN** the example project with `parallel.shared_files: [src/headings.ts]`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the three rules after `- Never run git or azimuth, and never edit anything under .azimuth/.` are ``- `src/headings.ts` is shared: other tasks may be adding to it at the same time. Add one complete insertion to it (a whole enum variant, match arm, registry entry or module line).``, `- Never edit or reorder another task's insertion in a shared file.` and `- Don't run a formatter over a shared file or its package.`, and the closing request of S-022.3.1 follows them as the brief's last line

### S-022.1.2 · Shared files matched by a glob, each named once {edge}
- **GIVEN** the example project with `parallel.shared_files: ["src/registry/*.ts"]` and T-001.2's `files: [src/registry/keys.ts, src/headings.ts, src/registry/nested/deep.ts, src/registry/commands.ts, src/registry/keys.ts]`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the four rules after `- Never run git or azimuth, and never edit anything under .azimuth/.` are ``- `src/registry/keys.ts` is shared: other tasks may be adding to it at the same time. Add one complete insertion to it (a whole enum variant, match arm, registry entry or module line).``, ``- `src/registry/commands.ts` is shared: other tasks may be adding to it at the same time. Add one complete insertion to it (a whole enum variant, match arm, registry entry or module line).``, `- Never edit or reorder another task's insertion in a shared file.` and `- Don't run a formatter over a shared file or its package.`
- **AND** no rule names `src/headings.ts` or `src/registry/nested/deep.ts`

### S-022.1.3 · A task without a shared file gets no shared-file rule {negative}
- **GIVEN** the example project with `parallel.shared_files: [src/registry.ts]`, a file T-001.2 doesn't list
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the Rules are exactly six lines: ``- Start each test name with the scenario it covers: `it("S-001.1.1 <what it checks>", …)`.``, `- Give every test a name that no other test in the project has.`, `- Write the tests first and run them to see them fail for the right reason, then implement until the verify command passes. Keep to the contract and the invariants.`, `- Change only the files under "Files you may change".`, `- Never run git or azimuth, and never edit anything under .azimuth/.` and the closing request of S-022.3.1
- **AND** no line of the brief contains the word `shared`

## ST-022.2 · The project's conventions are in the brief
**Intent:** As an orchestrator, I want every brief to carry the project's conventions, so that each lane follows them without my pasting them in.

### S-022.2.1 · Conventions nest under their own section {happy}
- **GIVEN** the example project with a `.azimuth/project/conventions.md` of frontmatter `updated: 2026-10-01`, the title `# Conventions`, then `## Testing`, `Vitest, one test file per module.`, a blank line, and a `~~~sh` fence holding `# run one file` and `pnpm exec vitest run test/x.test.ts`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the text right after `Heading levels are 1-based.` is `\n\n## Conventions\n\n### Testing\nVitest, one test file per module.\n\n~~~sh\n# run one file\npnpm exec vitest run test/x.test.ts\n~~~\n\n## Rules\n\n`

### S-022.2.2 · No conventions file, or one without a body {edge}
- **GIVEN** the example project without conventions.md, and separately the example project with a conventions.md of only the lines `---`, `updated: 2026-10-01`, `---` and `# Conventions`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs on each
- **THEN** neither brief has a line `## Conventions`, and in both the text right after `Heading levels are 1-based.` is `\n\n## Rules\n\n`

### S-022.2.3 · The template init wrote is left out {edge}
- **GIVEN** the example project whose conventions.md is the file `initProject` writes with `now` 2025-01-01T00:00:00Z, so its frontmatter is `updated: 2025-01-01`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief has no line `## Conventions`
- **AND** it has none either when that file has a blank line added after each `## ` heading, as Prettier writes it

### S-022.2.4 · The template with one line added is the project's conventions {edge}
- **GIVEN** the example project whose conventions.md is the file of S-022.2.3 with the line `Errors are values.` added right after `## Error handling`
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief holds ``## Conventions\n\n### Error handling\nErrors are values.\n\n### Testing\nStart each test name with the scenario ID it covers.\n\n### Naming\n\n### Logging\n\n### Dependencies\n\n### Commits\nConventional Commits with a `Refs:` trailer naming the task or feature.\n\n## Rules``

### S-022.2.5 · Conventions over 1,500 words become a pointer {edge}
- **GIVEN** the example project whose conventions.md is frontmatter `updated: 2026-10-01`, the title `# Conventions` and one line of the word `rule` 1,501 times, separated by single spaces
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief holds ``## Conventions\n\nThe project's conventions are too long to include here: read `.azimuth/project/conventions.md` and follow what applies to this task.\n\n## Rules``

### S-022.2.6 · Exactly 1,500 words are included in full {edge}
- **GIVEN** the example project whose conventions.md is that of S-022.2.5 with the word `rule` 1,500 times
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the line after `## Conventions` and a blank line is the word `rule` 1,500 times, separated by single spaces, and the brief has no line starting `The project's conventions are too long`

## ST-022.3 · The brief closes with what to report
**Intent:** As an orchestrator, I want each lane asked for what the task taught, the files it changed outside its list and the values its tests proved, so that I have what `azimuth note` and `azimuth settle` need without asking again.

### S-022.3.1 · The closing request without placeholders {happy}
- **GIVEN** the example project, none of whose scenarios holds a placeholder
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief's last line is `- When you are done, report: the files you changed; the verify command's result; what the task taught that later tasks should know (a constraint the code revealed, a choice the spec left open); each file you had to change outside "Files you may change", and why.`
- **AND** no line of the brief is `- When you are done, report the files you changed and the verify command's result.` or starts with ``- `⟦?⟧` marks``

### S-022.3.2 · An open placeholder adds the value clause, once {edge}
- **GIVEN** the example project with S-001.1.1's THEN `one heading starts at byte ⟦?⟧` and an AND `it ends at byte ⟦=4⟧` after it
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief's last two lines are ``- `⟦?⟧` marks a value the spec leaves to the first passing test: make the test assert the value the code produces.`` and ``- When you are done, report: the files you changed; the verify command's result; what the task taught that later tasks should know (a constraint the code revealed, a choice the spec left open); each file you had to change outside "Files you may change", and why; the value each `⟦?⟧` took in a passing test, as `<scenario ID>: <value>`.``
- **AND** `<scenario ID>: <value>` occurs exactly once in the brief

### S-022.3.3 · Settled values alone add no clause {edge}
- **GIVEN** the example project with S-001.1.1's THEN `one heading starts at byte ⟦=0⟧` and no open placeholder in S-001.1.1 or S-001.1.2
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** the brief's last line is the closing request of S-022.3.1, it holds the line `- **THEN** one heading starts at byte 0`, and no line starts with ``- `⟦?⟧` marks``

## ST-022.4 · The full brief is the same for the same records
**Intent:** As an orchestrator, I want the brief with all its new parts to come out the same from the same records, so that a lane's prompt can be reproduced and tested.

### S-022.4.1 · The full brief of the example {happy}
- **GIVEN** the example project with `parallel.shared_files: [src/headings.ts]` and the conventions.md of S-022.2.1
- **WHEN** `taskBrief(loadProject(root), "T-001.2")` runs
- **THEN** it returns exactly `F022_EXAMPLE_BRIEF` of contract.md ("Brief example"): F-009's sections up to the notes, the Conventions section of S-022.2.1, then nine rules (the test-name rule, the four standing rules, the three shared-file rules of S-022.1.1 and the closing request of S-022.3.1)

### S-022.4.2 · Another folder and another date give the same text {edge}
- **GIVEN** the project of S-022.4.1 written to two different temporary folders
- **WHEN** `taskBrief` runs on the first with the clock set to 2026-10-20T12:00:00Z and on the second with the clock set to 2027-03-01T08:00:00Z (`vi.setSystemTime`)
- **THEN** the two texts are equal to each other and to `F022_EXAMPLE_BRIEF`, and neither contains either folder's absolute path
