# F-010: Stories

## ST-010.1 · parallel.shared_files in config.yaml and the index
**Intent:** As a developer, I want to list the files that tasks extend additively, so that Azimuth and the viewer treat them as shared.

### S-010.1.1 · The list is empty when the key is absent {happy}
- **GIVEN** a config.yaml with `project: { name: Demo }`
- **WHEN** `parseConfig` reads it
- **THEN** `config.parallel.shared_files` is `[]` and `problems` is `[]`

### S-010.1.2 · A configured list is read as given {happy}
- **GIVEN** a config.yaml with `project: { name: Demo }` and `parallel: { shared_files: [src/registry.ts, "keymaps/*.toml"] }`
- **WHEN** `parseConfig` reads it
- **THEN** `config.parallel.shared_files` is `["src/registry.ts", "keymaps/*.toml"]` and `problems` is `[]`

### S-010.1.3 · A value that isn't a list is rejected {negative}
- **GIVEN** a config.yaml with `project: { name: Demo }` and `parallel: { shared_files: src/registry.ts }`
- **WHEN** `parseConfig` reads it
- **THEN** its only problem is `E-SCHEMA` "parallel.shared_files must be a list of text values." and `config.parallel.shared_files` is `[]`

### S-010.1.4 · The index carries the configured globs {happy}
- **GIVEN** a project whose config.yaml sets `parallel: { shared_files: [src/registry.ts] }`
- **WHEN** `azimuth status --json` runs
- **THEN** the printed index's `project.shared_files` is `["src/registry.ts"]` and the command exits 0

### S-010.1.5 · The index carries an empty list by default {edge}
- **GIVEN** a project whose config.yaml has no `parallel` key
- **WHEN** `azimuth status --json` runs
- **THEN** the printed index's `project.shared_files` is `[]`

## ST-010.2 · Shared files are never file conflicts
**Intent:** As an orchestrator, I want `W-FILE-CONFLICT` and the viewer's conflict flag to stay silent about registry files, so that the conflicts they still report mean something.

### S-010.2.1 · A shared path is not reported {happy}
- **GIVEN** a config with `parallel: { shared_files: [src/registry.ts] }`, F-001 in progress and F-002 verifying, both with impact entries `src/a.ts` (modify) and `src/registry.ts` (modify)
- **WHEN** `validate` checks the project
- **THEN** its `W-FILE-CONFLICT` messages are exactly `["F-001 and F-002 both modify src/a.ts."]`

### S-010.2.2 · The index's file conflicts skip it too {happy}
- **GIVEN** the config and features of S-010.2.1
- **WHEN** `derive` computes the derived values
- **THEN** F-001's `file_conflicts` is `[{ path: "src/a.ts", with: "F-002" }]` and F-002's is `[{ path: "src/a.ts", with: "F-001" }]`

### S-010.2.3 · A single star matches within one directory {edge}
- **GIVEN** a config with `parallel: { shared_files: ["keymaps/*.toml"] }`, F-001 in progress and F-002 verifying, both with impact entries `keymaps/default.toml` (modify) and `keymaps/vim/extra.toml` (create)
- **WHEN** `validate` checks the project
- **THEN** its `W-FILE-CONFLICT` messages are exactly `["F-001 and F-002 both modify keymaps/vim/extra.toml."]`

### S-010.2.4 · Without shared files every common path is reported {negative}
- **GIVEN** the features of S-010.2.1 and a config without a `parallel` key
- **WHEN** `validate` checks the project
- **THEN** its `W-FILE-CONFLICT` messages are exactly `["F-001 and F-002 both modify src/a.ts.", "F-001 and F-002 both modify src/registry.ts."]`

## ST-010.3 · Ready tasks are grouped by the files they share
**Intent:** As an orchestrator, I want a feature's ready tasks split into groups whose tasks share only shared files, so that I can launch a whole group of subagents at once.

### S-010.3.1 · Tasks that share only a shared file form one group {happy}
- **GIVEN** tasks T-001.2 with files `["src/a.ts", "src/registry.ts"]` and T-001.3 with files `["src/b.ts", "src/registry.ts"]`, and shared files `["src/registry.ts"]`
- **WHEN** `parallelGroups` groups them
- **THEN** it returns `[{ tasks: ["T-001.2", "T-001.3"], shared: ["src/registry.ts"] }]`

### S-010.3.2 · A common file outside the list keeps two tasks apart {negative}
- **GIVEN** tasks T-001.2 with files `["src/a.ts", "src/registry.ts"]`, T-001.3 with files `["src/a.ts"]` and T-001.4 with files `["src/c.ts", "src/registry.ts"]`, and shared files `["src/registry.ts"]`
- **WHEN** `parallelGroups` groups them
- **THEN** it returns `[{ tasks: ["T-001.2", "T-001.4"], shared: ["src/registry.ts"] }, { tasks: ["T-001.3"], shared: [] }]`

### S-010.3.3 · A task without files gets a group of its own {edge}
- **GIVEN** tasks T-001.2 with files `["src/a.ts"]`, T-001.3 with files `[]` and T-001.4 with files `["src/b.ts"]`, and shared files `[]`
- **WHEN** `parallelGroups` groups them
- **THEN** it returns `[{ tasks: ["T-001.2", "T-001.4"], shared: [] }, { tasks: ["T-001.3"], shared: [] }]`

### S-010.3.4 · A group names only the shared files two of its tasks list, sorted {edge}
- **GIVEN** tasks T-001.2 with files `["src/registry.ts", "keymaps/default.toml", "src/a.ts"]` and T-001.3 with files `["keymaps/default.toml", "src/registry.ts", "src/action.ts", "src/b.ts"]`, and shared files `["src/registry.ts", "src/action.ts", "keymaps/*.toml"]`
- **WHEN** `parallelGroups` groups them
- **THEN** it returns `[{ tasks: ["T-001.2", "T-001.3"], shared: ["keymaps/default.toml", "src/registry.ts"] }]`

### S-010.3.5 · Tasks already in progress lead the groups {happy}
- **GIVEN** a project without shared files and F-001 in progress with T-001.1 (done), T-001.2 (todo, after T-001.1, files `["src/a.ts"]`), T-001.3 (in-progress, files `["src/a.ts"]`), T-001.4 (todo, files `["src/b.ts"]`) and T-001.5 (todo, after T-001.4, files `["src/c.ts"]`)
- **WHEN** `taskGroups` groups F-001's ready tasks in the built index
- **THEN** it returns `[{ tasks: ["T-001.3", "T-001.4"], shared: [] }, { tasks: ["T-001.2"], shared: [] }]`

### S-010.3.6 · A feature that isn't in progress has no groups {negative}
- **GIVEN** a project with F-001 approved and two todo tasks without `after`, T-001.1 with files `["src/a.ts"]` and T-001.2 with files `["src/b.ts"]`
- **WHEN** `taskGroups` groups F-001's ready tasks in the built index
- **THEN** it returns `[]`

## ST-010.4 · azimuth next F-NNN says which ready tasks can run together
**Intent:** As an orchestrator, I want `azimuth next F-NNN` to print the groups, so that I don't work out file overlaps by hand before launching subagents.

### S-010.4.1 · Group lines follow the ready tasks {happy}
- **GIVEN** a project with `parallel: { shared_files: [src/registry.ts] }` and F-001 in progress with todo tasks without `after` or covers: T-001.2 with files `["src/a.ts", "src/registry.ts"]`, T-001.3 with files `["src/b.ts", "src/registry.ts"]` and T-001.4 with files `["src/a.ts"]`
- **WHEN** `azimuth next F-001` runs
- **THEN** the last two lines of its stdout are `Can run together: T-001.2, T-001.3 (shared: src/registry.ts)` and `On its own: T-001.4`, and it exits 0

### S-010.4.2 · --json carries the groups {happy}
- **GIVEN** the project of S-010.4.1
- **WHEN** `azimuth next F-001 --json` runs
- **THEN** its stdout parses to an object whose `items` have refs `["T-001.2", "T-001.3", "T-001.4"]` and whose `groups` is `[{ "tasks": ["T-001.2", "T-001.3"], "shared": ["src/registry.ts"] }, { "tasks": ["T-001.4"], "shared": [] }]`

### S-010.4.3 · A group without shared files names none {edge}
- **GIVEN** a project with `parallel: { shared_files: [src/registry.ts] }` and F-001 in progress with todo tasks without `after` or covers: T-001.2 with files `["src/a.ts"]` and T-001.3 with files `["src/b.ts"]`
- **WHEN** `azimuth next F-001` runs
- **THEN** the last line of its stdout is `Can run together: T-001.2, T-001.3`

### S-010.4.4 · A single ready task prints no group line {edge}
- **GIVEN** a project with F-001 in progress, T-001.1 (done) and T-001.2 (todo, after T-001.1, no covers, files `["src/a.ts"]`)
- **WHEN** `azimuth next F-001` runs
- **THEN** its stdout is exactly `T-001.2 azimuth move T-001.2 in-progress\n  F-001\n` and it exits 0

### S-010.4.5 · next without an ID keeps its JSON array {negative}
- **GIVEN** the project of S-010.4.1
- **WHEN** `azimuth next --json` runs
- **THEN** its stdout parses to an array (not an object) whose refs are `["T-001.2", "T-001.3", "T-001.4"]`
