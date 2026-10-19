# F-013: Stories

## ST-013.1 · check lists errors and counts warnings
**Intent:** As an orchestrating agent, I want `azimuth check` to list every error but count warnings by code on one line, so that errors aren't buried under hundreds of warnings.

### S-013.1.1 · Without IDs, warnings are counted by code {happy}
- **GIVEN** a project whose only feature F-001 (slug `thing`, draft) has stories ST-001.1 and ST-001.2 with one happy scenario each, and tasks T-001.1 (covers S-001.1.1, after T-001.2) and T-001.2 (covers nothing, after T-001.1), so its problems are one E-TASK-CYCLE, two W-NO-NEGATIVE and one W-UNCOVERED-SCENARIO
- **WHEN** `azimuth check` runs
- **THEN** stdout is exactly the lines `E-TASK-CYCLE .azimuth/features/F-001-thing/plan.md F-001`, `  Tasks wait for each other in a cycle: T-001.2, T-001.1.`, `3 warnings: 2 W-NO-NEGATIVE, 1 W-UNCOVERED-SCENARIO (--warnings lists them)`, an empty line and `1 errors, 3 warnings`, and the exit code is 1

### S-013.1.2 · --warnings lists every warning {edge}
- **GIVEN** the project of S-013.1.1
- **WHEN** `azimuth check --warnings` runs
- **THEN** stdout has the E-TASK-CYCLE entry, two lines starting with `W-NO-NEGATIVE .azimuth/features/F-001-thing/stories.md:`, the line `W-UNCOVERED-SCENARIO .azimuth/features/F-001-thing/plan.md S-001.2.1`, no line containing `--warnings lists them`, and ends with `1 errors, 3 warnings`; the exit code is 1

### S-013.1.3 · An ID lists every warning of that item {edge}
- **GIVEN** the project of S-013.1.1
- **WHEN** `azimuth check F-001` runs
- **THEN** stdout equals the stdout of `azimuth check --warnings` on the same project, and the exit code is 1

### S-013.1.4 · Warnings only print one summary and exit 0 {edge}
- **GIVEN** the project of S-013.1.1 with T-001.2 no longer after T-001.1, so only the three warnings remain
- **WHEN** `azimuth check` runs
- **THEN** stdout is exactly `3 warnings: 2 W-NO-NEGATIVE, 1 W-UNCOVERED-SCENARIO (--warnings lists them)\n\n0 errors, 3 warnings\n` and the exit code is 0

### S-013.1.5 · --json still lists every problem {edge}
- **GIVEN** the project of S-013.1.1
- **WHEN** `azimuth check --json` runs
- **THEN** stdout is a JSON array of 4 problems, 1 with `severity: "error"` and 3 with `severity: "warning"`, and the exit code is 1

## ST-013.2 · trace hides mention-only references
**Intent:** As an orchestrating agent, I want `azimuth trace` to show only test references by default, so that comments citing a scenario ID don't look like misses.

### S-013.2.1 · Mention-only references are hidden and counted {happy}
- **GIVEN** F-001 (slug `thing`, draft) with scenarios S-001.1.1 and S-001.1.2, both titled "Scenario", and `test/pay.test.ts` holding the comment `// Follows S-001.1.1 and the refund flow.`, the test `it("S-001.1.1 charges the card", () => {});` and the comment `// S-001.1.2 waits for the bank stub.`
- **WHEN** `azimuth trace F-001` runs
- **THEN** stdout is exactly the lines `S-001.1.1 not-run Scenario`, `    test/pay.test.ts: S-001.1.1 charges the card`, `S-001.1.2 not-run Scenario` and `2 mention-only references hidden (--all shows them)`, and the exit code is 0

### S-013.2.2 · --all shows them marked (mention) {edge}
- **GIVEN** the project of S-013.2.1
- **WHEN** `azimuth trace F-001 --all` runs
- **THEN** stdout is exactly the lines `S-001.1.1 not-run Scenario`, `    test/pay.test.ts: S-001.1.1 charges the card`, `    test/pay.test.ts: // Follows S-001.1.1 and the refund flow. (mention)`, `S-001.1.2 not-run Scenario` and `    test/pay.test.ts: // S-001.1.2 waits for the bank stub. (mention)`

### S-013.2.3 · Without mentions there is no hint {edge}
- **GIVEN** the project of S-013.2.1 with `test/pay.test.ts` holding only `it("S-001.1.1 charges the card", () => {});`
- **WHEN** `azimuth trace F-001` runs
- **THEN** stdout is exactly the lines `S-001.1.1 not-run Scenario`, `    test/pay.test.ts: S-001.1.1 charges the card` and `S-001.1.2 untested Scenario`

### S-013.2.4 · --json keeps mention-only references {edge}
- **GIVEN** the project of S-013.2.1
- **WHEN** `azimuth trace F-001 --json` runs
- **THEN** the row whose `scenario` is `S-001.1.2` has `tests` equal to `[{"file": "test/pay.test.ts", "name": "// S-001.1.2 waits for the bank stub.", "status": "not-run", "confidence": "fallback"}]`

## ST-013.3 · new prints only the ID
**Intent:** As an agent chaining `azimuth new` commands, I want stdout to carry only the new ID, also when a later step fails, so that I capture every ID with `$(…)` and never lose one.

### S-013.3.1 · The ID goes to stdout, the file to stderr {happy}
- **GIVEN** a project without issues
- **WHEN** `azimuth new issue "Crash on save"` runs
- **THEN** stdout is exactly `BUG-0001\n`, stderr is exactly `created .azimuth/issues/BUG-0001-crash-on-save.md\n` and the exit code is 0

### S-013.3.2 · Several files share one stderr line {edge}
- **GIVEN** a project without features
- **WHEN** `azimuth new feature "Pay by card"` runs
- **THEN** stdout is exactly `F-001\n`, stderr is exactly `created .azimuth/features/F-001-pay-by-card/feature.md, .azimuth/features/F-001-pay-by-card/log.md\n` and the exit code is 0

### S-013.3.3 · Chained creations each print their own ID {edge}
- **GIVEN** a project without questions
- **WHEN** `azimuth new question "Which card brands?"` runs and then `azimuth new question "Which currency?"`
- **THEN** their stdouts are exactly `Q-0001\n` and `Q-0002\n`, and the frontmatter `title` of `.azimuth/questions/Q-0002.md` is `Which currency?`

### S-013.3.4 · --json output is unchanged {edge}
- **GIVEN** a project without issues
- **WHEN** `azimuth new issue "Crash on save" --json` runs
- **THEN** stdout parses to `{"id": "BUG-0001", "files": [".azimuth/issues/BUG-0001-crash-on-save.md"]}`, stderr is empty and the exit code is 0

### S-013.3.5 · A failure after creating the file still prints the ID {negative}
- **GIVEN** a project without issues, where recording the new ID in the current session fails with the `busy` error "Another Azimuth command is writing; try again in a moment."
- **WHEN** `azimuth new issue "Crash on save"` runs
- **THEN** stdout is exactly `BUG-0001\n`, stderr is exactly `created .azimuth/issues/BUG-0001-crash-on-save.md\n✗ Another Azimuth command is writing; try again in a moment.\n`, the exit code is 1 and `.azimuth/issues/BUG-0001-crash-on-save.md` exists

### S-013.3.6 · Fields that can't be written leave no file and use no ID {negative}
- **GIVEN** a project template `.azimuth/templates/issue-bug.md` whose frontmatter has an unclosed quote (`title: "{{title}}`)
- **WHEN** `azimuth new issue "Crash on save" --files src/app.ts` runs
- **THEN** stdout is empty, the exit code is 3 and no file exists under `.azimuth/issues/`
- **AND** after the template is deleted, `azimuth new issue "Crash on save"` prints exactly `BUG-0001\n`
