# F-020: Notes

### T-020.1 · 2026-10-20

The markCommitted placeholder names its unused arguments _root and _changed for the lint rule: rename them back and drop its comment when T-020.3 replaces the body. It already returns every ref committed, so S-020.2.5 passes before T-020.3's change. T-020.2 replaces only changed: [] in gitFacts' return. Nothing calls markCommitted yet; T-020.4 wires analyzeProject.

### T-020.3 · 2026-10-20

markCommitted trusts changed as given: analyzeProject must pass git.available ? git.changed : null, since an empty changed from a failed status call marks everything committed. T-020.4: add the close-out repository helper to test/core/committed-tests.test.ts next to project(), which uses featureFiles with F-001 in-progress.
