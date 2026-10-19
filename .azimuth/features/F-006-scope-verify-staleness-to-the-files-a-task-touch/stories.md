# F-006: Stories

## ST-006.1 · A run depends on its task's and feature's own paths
**Intent:** As the done gate, I want to know which paths a task's verify run depends on, so that commits elsewhere leave the run current.

### S-006.1.1 · Task files and changed impact paths are in scope {happy}
- **GIVEN** a task with files `["src/a.ts"]`, a feature whose impact lists `src/b.ts` (create), `test/a.test.ts` (test) and `src/c.ts` (read), no modules and no shared paths
- **WHEN** `runScope` builds the scope and `inScope` checks paths against it
- **THEN** `src/a.ts`, `src/b.ts` and `test/a.test.ts` are in scope, and `src/c.ts` and `src/d.ts` are not

### S-006.1.2 · A path naming a directory covers everything under it {edge}
- **GIVEN** a task with files `["src/parser/", "./docs/guide.md"]`, an empty impact, no modules and no shared paths
- **WHEN** `inScope` checks paths against its scope
- **THEN** `src/parser`, `src/parser/inline/emph.ts` and `docs/guide.md` are in scope, and `src/parserx/a.ts` and `src/parser.ts` are not

### S-006.1.3 · No paths of its own means no scope {edge}
- **GIVEN** a task with files `[]`, a feature whose impact lists only `src/c.ts` (read), a module `core` (`src/core`) and the default shared paths
- **WHEN** `runScope` builds the scope
- **THEN** it returns `null`

## ST-006.2 · Module dependencies and shared files widen the scope
**Intent:** As an orchestrator, I want changes to the modules a feature builds on and to the project's build manifests to stale its runs, so that a run never stays current across a change that can break it.

### S-006.2.1 · Paths of the modules the feature's modules depend on {happy}
- **GIVEN** modules `editor` (`src/editor`, depends_on `[buffer]`), `buffer` (`src/buffer`) and `search` (`src/search`), a task with files `["src/editor/view.rs"]` and an impact listing `src/editor/view.rs` (modify)
- **WHEN** `inScope` checks paths against its scope
- **THEN** `src/buffer/gap.rs` and `src/buffer.rs` are in scope, and `src/editor/cursor.rs` and `src/search/index.rs` are not

### S-006.2.2 · Test and read entries bring in no module dependencies {edge}
- **GIVEN** modules `editor` (`src/editor`), `buffer` (`src/buffer`), `tests` (`tests`, depends_on `[buffer]`) and `search` (`src/search`, depends_on `[buffer]`), a task with files `[]`, and an impact listing `src/editor/view.rs` (modify), `tests/view.rs` (test) and `src/search/index.rs` (read)
- **WHEN** `inScope` checks `src/buffer/gap.rs` against its scope
- **THEN** it returns `false`

### S-006.2.3 · The default shared paths match root manifests only {happy}
- **GIVEN** a task with files `["src/a.ts"]`, no modules and the default `verify.shared_paths`
- **WHEN** `inScope` checks paths against its scope
- **THEN** `Cargo.lock` and `package.json` are in scope, and `crates/core/Cargo.toml` and `viewer/package.json` are not

## ST-006.3 · The first later commit that touches the scope makes a run stale
**Intent:** As the done gate, I want the commit and path that made a run stale, so that I can say what changed.

### S-006.3.1 · Commits outside the scope keep the run current {happy}
- **GIVEN** a run at `aaaaaaa`, later commits `bbbbbbb` changing `src/b.ts` and `ccccccc` (HEAD) changing `docs/x.md`, and `touches` true only for `src/a.ts`
- **WHEN** `staleCause("aaaaaaa", facts, touches)` runs
- **THEN** it returns `null`

### S-006.3.2 · The earliest touching commit and its first matching path are named {negative}
- **GIVEN** a run at `aaaaaaa`, later commits `bbbbbbb` changing `src/b.ts`, `ccccccc` changing `src/a.ts` and `src/z.ts`, and `ddddddd` (HEAD) changing `src/z.ts`, and `touches` true for `src/a.ts` and `src/z.ts`
- **WHEN** `staleCause("aaaaaaa", facts, touches)` runs
- **THEN** it returns `{ kind: "changed", commit: "ccccccc", path: "src/a.ts" }`

### S-006.3.3 · Without a scope, the first path outside .azimuth/ counts {edge}
- **GIVEN** a run at `aaaaaaa`, later commits `bbbbbbb` changing only `.azimuth/features/F-001-x/as-built.md` and `ccccccc` (HEAD) changing `.azimuth/features/F-001-x/log.md` and `docs/readme.md`
- **WHEN** `staleCause("aaaaaaa", facts, null)` runs
- **THEN** it returns `{ kind: "changed", commit: "ccccccc", path: "docs/readme.md" }`

### S-006.3.4 · Azimuth's records never count, even in scope {edge}
- **GIVEN** a run at `aaaaaaa`, a later commit `bbbbbbb` (HEAD) changing only `.azimuth/project/architecture.md`, and `touches` true for every path
- **WHEN** `staleCause("aaaaaaa", facts, touches)` runs
- **THEN** it returns `null`

### S-006.3.5 · A later commit with unknown files {negative}
- **GIVEN** a run at `aaaaaaa` and a later commit `bbbbbbb` (HEAD) with no entry in `facts.git.files`
- **WHEN** `staleCause("aaaaaaa", facts, touches)` runs with `touches` false for every path
- **THEN** it returns `{ kind: "unknown-files", commit: "bbbbbbb" }`

### S-006.3.6 · A run outside the history read {negative}
- **GIVEN** commits `bbbbbbb` (HEAD) and `aaaaaaa`, and a run at `9999999`, which is not among them
- **WHEN** `staleCause("9999999", facts, null)` runs
- **THEN** it returns `{ kind: "outside-history" }`

## ST-006.4 · The done gate reports what made a run stale
**Intent:** As an orchestrator, I want `done.verify-passed` to pass across unrelated commits and to name the commit and path that staled a run, so that I rerun only the verifies that need it.

### S-006.4.1 · Another feature's commit keeps the run current {happy}
- **GIVEN** F-001 in verifying, its impact listing `src/a.ts` (modify), T-001.1 (done, files `["src/a.ts"]`) whose run passed at `aaaaaaa`, and a later code commit `bbbbbbb` (HEAD) changing `src/b.ts`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok: true`

### S-006.4.2 · A commit to the task's file names the commit and path {negative}
- **GIVEN** the feature and run of S-006.4.1, and a later commit `bbbbbbb` (HEAD) changing `src/a.ts`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok: false` and detail `T-001.1 last passed at aaaaaaa; bbbbbbb changed src/a.ts`

### S-006.4.3 · A later commit with unknown files names the commit {negative}
- **GIVEN** the feature and run of S-006.4.1, and a later commit `bbbbbbb` (HEAD) whose changed files aren't known
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok: false` and detail `T-001.1 last passed at aaaaaaa; bbbbbbb's changed files are unknown`

### S-006.4.4 · A run outside the history read keeps today's detail {edge}
- **GIVEN** the feature of S-006.4.1 with T-001.1's run passed at `9999999`, which is not among the commits read
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok: false` and detail `T-001.1 last passed at 9999999`

### S-006.4.5 · Configured shared paths replace the defaults {edge}
- **GIVEN** the feature and run of S-006.4.1, config `verify.shared_paths: ["crates/*/Cargo.toml"]`, and later commits `bbbbbbb` changing `Cargo.lock` and `ccccccc` (HEAD) changing `crates/core/Cargo.toml`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok: false` and detail `T-001.1 last passed at aaaaaaa; ccccccc changed crates/core/Cargo.toml`

### S-006.4.6 · A task without paths falls back to any code commit {edge}
- **GIVEN** F-001 in verifying, its impact listing only `src/c.ts` (read), T-001.1 (done, no files) whose run passed at `aaaaaaa`, and a later commit `bbbbbbb` (HEAD) changing `docs/readme.md`
- **WHEN** F-001's done gate is evaluated
- **THEN** `done.verify-passed` has `ok: false` and detail `T-001.1 last passed at aaaaaaa; bbbbbbb changed docs/readme.md`

## ST-006.5 · Issue #1 no longer reproduces
**Intent:** As an orchestrator, I want `azimuth show F --brief` to keep a feature's runs current across another feature's commits, so that close-out doesn't rerun every verify.

### S-006.5.1 · A commit to a file only another feature lists {happy}
- **GIVEN** a git repository with F-001 (T-001.1, files `["src/a.ts"]`, impact `src/a.ts`) and F-002 (T-002.1, files `["src/b.ts"]`, impact `src/b.ts`) in verifying, a passing run of T-001.1 at commit X, and a later commit Y with `Refs: T-002.1` changing only `src/b.ts`
- **WHEN** the index is built and `showBrief(index, "F-001")` renders `show F-001 --brief`
- **THEN** its output contains the line `  ✓ Latest verify run of every task passed at HEAD`

### S-006.5.2 · A commit to the feature's own file {negative}
- **GIVEN** the repository of S-006.5.1, but commit Y changes `src/a.ts`
- **WHEN** the index is built and `showBrief(index, "F-001")` renders `show F-001 --brief`
- **THEN** its output contains the line `  ✗ Latest verify run of every task passed at HEAD — T-001.1 last passed at X; Y changed src/a.ts`, with X and Y the 7-character SHAs

## ST-006.6 · verify.shared_paths in config.yaml
**Intent:** As a developer, I want to list the files every verify run depends on, so that my project's build manifests stale runs wherever they live.

### S-006.6.1 · The defaults apply when the key is absent {happy}
- **GIVEN** a config.yaml with `project: { name: Demo }` and `verify: { timeout_seconds: 600 }`
- **WHEN** `parseConfig` reads it
- **THEN** `config.verify.shared_paths` is `["package.json", "pnpm-lock.yaml", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum", "pyproject.toml", "uv.lock"]` and `problems` is `[]`

### S-006.6.2 · A configured list is read as given {happy}
- **GIVEN** a config.yaml with `project: { name: Demo }` and `verify: { shared_paths: ["crates/*/Cargo.toml", Cargo.lock] }`
- **WHEN** `parseConfig` reads it
- **THEN** `config.verify.shared_paths` is `["crates/*/Cargo.toml", "Cargo.lock"]`

### S-006.6.3 · A value that isn't a list is rejected {negative}
- **GIVEN** a config.yaml with `project: { name: Demo }` and `verify: { shared_paths: package.json }`
- **WHEN** `parseConfig` reads it
- **THEN** its only problem is `E-SCHEMA` "verify.shared_paths must be a list of text values." and `config.verify.shared_paths` keeps the default list
