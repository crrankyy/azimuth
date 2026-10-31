# F-028: Notes

### T-028.1 · 2026-10-31

tag and released_commit use r.text(), not r.string(): YAML reads a digits-only SHA like 1234567 as a number. The index spreads the parsed record, so the fields reach it unchanged.
