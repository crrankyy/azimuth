# F-023: Notes

### T-023.2 · 2026-10-20

T-023.3: validate.ts's import from ./derive and validate()'s list (milestoneProblems after questionProblems) changed; featureProblems is untouched. next.ts now imports ./derive, which pulls node:crypto through spec-hash: fine while nothing in viewer/ or src/server imports next.ts.
