# F-028: Notes

### T-028.1 · 2026-10-31

tag and released_commit use r.text(), not r.string(): YAML reads a digits-only SHA like 1234567 as a number. The index spreads the parsed record, so the fields reach it unchanged.

### T-028.7 · 2026-10-31

commitRefs already linked M- and BUG- IDs from the trailer and the scope, so S-028.1.1-1.3 needed no code. CONVENTIONS_TEMPLATE is what task-brief compares against, so F-022's S-022.2.4 test now expects the new Commits line; S-026.4.2's JSON gains T-028.1's tag and released_commit. Both tests adopted here.

### T-028.5 · 2026-10-31

MilestonePage gains commits (index commits whose refs name the milestone, at most 10 shown); S-026.3.1 compares the whole page, so its expected object gains commits: [] (adopted). The release section is empty when neither tag nor released_commit is set.
