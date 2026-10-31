# F-027: Notes

### T-027.1 · 2026-10-31

linkedSession checks existsSync before readSession, which returns null for a missing and an unparseable file alike; it reads only the session's own file (no loadProject), so pruneLive's keep callback and the hook can call it per file.

### T-027.2 · 2026-10-31

live.ts can't import session.ts (session.ts imports live.ts), so pruneLive takes a keep callback and the hook passes (c) => linkOpen(root, c). keep gets the file stem; a kept file is not touched, so its mtime stays.
