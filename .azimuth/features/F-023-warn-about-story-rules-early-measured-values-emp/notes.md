# F-023: Notes

### T-023.2 · 2026-10-20

T-023.3: validate.ts's import from ./derive and validate()'s list (milestoneProblems after questionProblems) changed; featureProblems is untouched. next.ts now imports ./derive, which pulls node:crypto through spec-hash: fine while nothing in viewer/ or src/server imports next.ts.

### T-023.1 · 2026-10-20

T-023.3: for each scenario loop over sc.thenLines and push W-MEASURED at l.line with ref sc.id when measuredValue(l.text) returns a value. In this repo 11 THEN/AND lines would hint in a draft, all decided fixture values (F-008 17..30, F-009 byte 3, F-018 bytes: 4200000000, F-023's own 9..12). A word only must not follow a letter, so free_bytes: 42 matches through 'bytes'; backticks count as separators, so the quoted fragment can start with one (offset `3).

### T-023.3 · 2026-10-20

T-023.4: put HINT_CODES and isHint near the top of validate.ts; the two codes come only from measuredHints and noCoversHints. Hookline has strict: false, so the golden test is unaffected. W-VAGUE is a parse problem in model.problems, so S-023.4.2's gate context must include it, as analyze() in analysis.test.ts does. check.test.ts's project() now has T-001.2 covering S-001.1.1 so F-013's pinned output stays true.

### T-023.4 · 2026-10-20

Docs (T-023.5): word the strict comments as 'hints aside'; codes outside HINT_CODES (W-NO-NEGATIVE, W-VAGUE, W-MILESTONE-READY) still count toward strict. S-023.4.1's warnings come out W-NO-COVERS first (sortProblems puts plan.md before stories.md); the THEN fixes no order and the test compares them sorted. gates.ts now imports isHint from validate.ts (no cycle).
