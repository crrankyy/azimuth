---
id: BUG-0025
type: bug
title: Verify can't attribute cargo test results to scenarios
status: resolved
severity: high
likelihood: null
impact: null
links: [BUG-0016]
files: [src/core/junit.ts, src/core/verify.ts]
found_by: SES-20261018-1552
created: 2026-10-18
resolved_at: 2026-10-18
---
## Repro
In a Rust crate, mark a unit test in `src/buffer.rs` with `// scenario: S-001.1.1` above its
`#[test] fn inserts_text_at_cursor`, and an integration test in `tests/render.rs` with
`// scenario: S-001.2.1`. Give a task covering both the verify command `cargo test`, then try
`cargo test no_such_test`.

## Expected
`cargo test` records both scenarios as passing (its output has
`test buffer::tests::inserts_text_at_cursor ... ok` and `test renders_heading ... ok`), and the
run that ran no tests records neither.

## Actual
Rust test names can't contain a scenario ID, so verify falls back to the test file's name in the
output. cargo prints only crate roots and integration test files (`Running unittests src/lib.rs`,
`Running tests/render.rs`), and prints them even when the filter skipped all their tests:

- S-001.1.1 never passes (`buffer.rs` never appears), so the feature can't reach done.
- S-001.2.1 passes on `cargo test no_such_test`, which ran 0 tests: the false pass BUG-0016 fixed.

A JUnit report (cargo nextest) doesn't help: it also needs the ID in the test name. On a failing
run, every covered scenario fails, even those whose tests printed `ok`.
