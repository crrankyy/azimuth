# F-027: Notes

### T-027.1 · 2026-10-31

linkedSession checks existsSync before readSession, which returns null for a missing and an unparseable file alike; it reads only the session's own file (no loadProject), so pruneLive's keep callback and the hook can call it per file.
