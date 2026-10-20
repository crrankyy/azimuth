# F-022: Notes

### T-022.1 · 2026-10-20

F-009's brief tests changed text only: OPEN_RULE lost its report clause, EXAMPLE_BRIEF's last line is now CLOSING_RULE, and S-009.7.2 checks the last two lines [OPEN_RULE, CLOSING_OPEN_RULE]. T-022.2: add a conventions option to exampleFiles; reuse CLOSING_RULE, CLOSING_OPEN_RULE, SHARED_RULES, sharedFileRule, rulesOf and rulesAfterNeverGit; the Conventions part goes right after the Notes parts.push in taskBrief.

### T-022.2 · 2026-10-20

This repo's own conventions.md (211 words) isn't the template, so every brief made here now has a Conventions section. init writes the same bytes as before (CONVENTIONS_TEMPLATE checked identical). The contract's taskBrief comment lists the invalid error; the source comment still mentions only not-found.
