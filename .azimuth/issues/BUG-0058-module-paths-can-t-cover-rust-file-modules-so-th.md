---
id: BUG-0058
type: bug
title: Module paths can't cover Rust file modules, so the agent changed the crate layout
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [src/core/validate.ts, plugin/skills/init/SKILL.md]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
In a Rust crate, give architecture.md a module `{ name: buffer, path: src/buffer }` and list `src/buffer.rs` in a feature's impact.md.

## Expected
`src/buffer.rs` counts as part of the `src/buffer` module (as `src/buffer.ts` or `pkg/buffer.py` would), so the project keeps its usual layout.

## Actual
A module path matches only exactly or as a directory prefix, so `src/buffer.rs` gets W-PATH. The init agent knew this and planned every module as `src/<name>/mod.rs`, writing that this is "how Azimuth maps files to modules": the tool chose the crate's layout. Rust 2018+ code usually uses `src/buffer.rs`.

Found in the Rust rehearsal on 2026-10-18 (~/projects/azimuth-rust-rehearsal).
