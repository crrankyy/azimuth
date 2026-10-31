# F-025: Notes

### T-025.1 · 2026-10-31

indexRuns in build-index.ts keeps its own copy of newestFirst's comparator; model.runs is oldest first by text, so runHistory sorts a copy. A task of a missing feature is refused as '<T-ID> does not exist.' (no scenario covers it).

### T-025.2 · 2026-10-31

parseLimit runs before runtime(), so a bad --limit exits 2 outside a project too. verify-report now exports seconds, outcome, tailLines and runResultLine for T-025.3.

### T-025.3 · 2026-10-31

show R-NNNN reads loadProject, never the index, so runs outside the index's window are found; F-026's show change must keep the run branch before buildIndex. parseRun omits waited_ms and ses when absent, so runPage checks !== undefined.
