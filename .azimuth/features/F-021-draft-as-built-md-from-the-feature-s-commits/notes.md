# F-021: Notes

### T-021.1 · 2026-10-20

contract.md's filesChanged comment said first-A-wins; S-021.1.2 (created then deleted is a delete) wins, and the contract was corrected (reapprove after this commit). T-021.3: noUncheckedIndexedAccess is on, so parse --name-status lines by splitting on the tab and checking the parts; paths sort in code-unit order, not localeCompare; deviationsFor keeps a non-blank reason as written and returns hand-written deviations as the same objects, so asBuiltText must write { path, kind, reason } in that order itself; deviationsFor relies on filesChanged having dropped .azimuth/ paths; the rerun case (reason carried from previous) is S-021.4's to test.

### T-021.2 · 2026-10-20

parseAsBuilt returns null when completed_at is missing and turns a missing or null reason into "", which the gate counts as blank.

### T-021.3 · 2026-10-20

T-021.4: writeAsBuilt throws AzimuthError(invalid) for a non-feature ID, but S-021.5.6 needs exit 2, so the command checks idKind and throws UsageError first. message has no trailing newline (print adds it); completed_at defaults to today's UTC date. Copy example() from test/core/as-built.test.ts into the CLI test. Gaps: an as-built.md opening --- without a closing fence counts as no frontmatter (kept as body, not refused); a done feature keeps an existing completed_at only when it is a non-empty string.

### T-021.4 · 2026-10-20

Docs (T-021.5): usage 'as-built <F-ID> [--json]'; exit 0 written, 1 unknown feature, wrong status, no git, invalid frontmatter or failed git log, 2 missing or non-feature ID or no project; --json prints the whole result. The feature joins the session's touched only on success. The git check accepts any folder inside a work tree, so the docs should say the project folder is the repository root (as F-006 assumes). S-021.5.1 can fail across midnight UTC, like note.test.ts.
