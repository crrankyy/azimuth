# F-020: Notes

### T-020.1 · 2026-10-20

The markCommitted placeholder names its unused arguments _root and _changed for the lint rule: rename them back and drop its comment when T-020.3 replaces the body. It already returns every ref committed, so S-020.2.5 passes before T-020.3's change. T-020.2 replaces only changed: [] in gitFacts' return. Nothing calls markCommitted yet; T-020.4 wires analyzeProject.
