# F-025: Notes

### T-025.1 · 2026-10-31

indexRuns in build-index.ts keeps its own copy of newestFirst's comparator; model.runs is oldest first by text, so runHistory sorts a copy. A task of a missing feature is refused as '<T-ID> does not exist.' (no scenario covers it).
