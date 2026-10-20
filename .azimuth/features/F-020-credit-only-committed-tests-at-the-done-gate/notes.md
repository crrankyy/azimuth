# F-020: Notes

### T-020.1 · 2026-10-20

The markCommitted placeholder names its unused arguments _root and _changed for the lint rule: rename them back and drop its comment when T-020.3 replaces the body. It already returns every ref committed, so S-020.2.5 passes before T-020.3's change. T-020.2 replaces only changed: [] in gitFacts' return. Nothing calls markCommitted yet; T-020.4 wires analyzeProject.

### T-020.3 · 2026-10-20

markCommitted trusts changed as given: analyzeProject must pass git.available ? git.changed : null, since an empty changed from a failed status call marks everything committed. T-020.4: add the close-out repository helper to test/core/committed-tests.test.ts next to project(), which uses featureFiles with F-001 in-progress.

### T-020.2 · 2026-10-20

changed lists every non-ignored path git reports, .azimuth/ files included: test repos need a .gitignore with .azimuth/cache/ or run files appear in changed (harmless, they aren't test files). Pass git.available ? git.changed : null to markCommitted. git.ts's parseStatus duplicates finish.ts's private porcelainPaths (it skips a rename's source and tracks XY for dirty); merging them is a later cleanup.

### T-020.4 · 2026-10-20

markCommitted treats null and [] alike (nothing read, all committed); analyzeProject passes null without git to state the intent. T-020.5: trace can read ScenarioTest.committed from the index; for a #2 repository in its tests, copy closeOut/runFile from test/core/committed-tests.test.ts (it has a repo: false mode for the no-git case).
