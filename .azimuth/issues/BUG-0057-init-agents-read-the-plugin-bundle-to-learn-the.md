---
id: BUG-0057
type: bug
title: Init agents read the plugin bundle to learn the architecture rules
status: open
severity: medium
likelihood: null
impact: null
links: []
files: [plugin/skills/init/SKILL.md, src/core/templates.ts]
found_by: SES-20261018-1612
created: 2026-10-18
resolved_at: null
---
## Repro
Run `/azimuth:init` in a new Rust crate.

## Expected
The skill and the files it writes say how `reconciled_at` is set for a greenfield plan, what `depends_on` names, how a file maps to a module path, and how tests are linked to scenarios in this language, so the agent can write the docs from them.

## Actual
The agent grepped `plugin/dist/cli.mjs` for `reconciled_at`, `depends_on`, `greenfield` and the `underModule` rule, and for how trace finds Rust scenario markers: 6 of its 25 tool calls. BUG-0019's commented examples show the entry format but not these rules; the marker format is in PROTOCOL.md, which it didn't rely on.

Found in the Rust rehearsal on 2026-10-18 (~/projects/azimuth-rust-rehearsal).
