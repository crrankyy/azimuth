# F-005: Stories

## ST-005.1 · Hooks record what each subagent was given
**Intent:** As the viewer, I want the live log to say what the Agent tool was asked to do and which subagent started, so that I can tell subagents apart.

### S-005.1.1 · A launch is recorded with its task {happy}
- **GIVEN** a PreToolUse hook for the `Agent` tool with `tool_use_id` `toolu_1`, description "Build T-002.2 heading recognizer" and prompt "Write the tests for S-002.1.1"
- **WHEN** the pre-tool-use hook runs
- **THEN** the session's live log ends with `{kind: "launch", tool_use_id: "toolu_1", description: "Build T-002.2 heading recognizer", refs: ["T-002.2"]}` and the hook exits 0 with no output

### S-005.1.2 · A launch without a task in its description takes the prompt's {edge}
- **GIVEN** a PreToolUse hook for the `Agent` tool with description "Heading recognizer" and prompt "Build T-002.2 for F-002"
- **WHEN** the pre-tool-use hook runs
- **THEN** the launch record's `refs` is `["T-002.2", "F-002"]`

### S-005.1.3 · A starting subagent is recorded {happy}
- **GIVEN** a SubagentStart hook with `agent_id` `a1` and `agent_type` `general-purpose`
- **WHEN** the subagent-start hook runs
- **THEN** the live log ends with `{kind: "subagent", agent_id: "a1", agent_type: "general-purpose"}`

### S-005.1.4 · A finishing subagent is recorded {happy}
- **GIVEN** a SubagentStop hook with `agent_id` `a1`
- **WHEN** the subagent-stop hook runs
- **THEN** the live log ends with `{kind: "subagent-stop", agent_id: "a1"}`

### S-005.1.5 · The Agent tool's record keeps the subagent it started {happy}
- **GIVEN** a PostToolUse hook for the `Agent` tool with `tool_use_id` `toolu_1` and a response whose `agentId` is `a1`
- **WHEN** the post-tool-use hook runs
- **THEN** its tool record has `tool_use_id: "toolu_1"` and `spawned: "a1"`

### S-005.1.6 · Other tools and other repositories record nothing new {negative}
- **GIVEN** a PreToolUse hook for the `Bash` tool, and separately a SubagentStart hook in a repository without `.azimuth/`
- **WHEN** the hooks run
- **THEN** neither appends a record, and both exit 0 with no output

## ST-005.2 · Live sessions know each subagent's assignment
**Intent:** As the viewer, I want each live agent to carry its task, feature and finish time, so that the index says who is doing what.

### S-005.2.1 · A subagent is matched exactly by the Agent tool's response {happy}
- **GIVEN** a live log with a launch `toolu_1` "Build T-002.2 heading recognizer", a subagent `a1`, and an Agent tool record with `tool_use_id` `toolu_1` and `spawned` `a1`
- **WHEN** the log is summarized
- **THEN** agent `a1` has description "Build T-002.2 heading recognizer", task `T-002.2` and feature `F-002`

### S-005.2.2 · A running foreground subagent is matched by order {happy}
- **GIVEN** launches `toolu_1` "Build T-002.2 …" and `toolu_2` "Build T-003.1 …", then subagents `a1` and `a2`, and no Agent tool records yet
- **WHEN** the log is summarized
- **THEN** `a1` has task `T-002.2` and `a2` has task `T-003.1`

### S-005.2.3 · An exact match overrides the order {edge}
- **GIVEN** the log of S-005.2.2 followed by Agent tool records `toolu_1 → a2` and `toolu_2 → a1`
- **WHEN** the log is summarized
- **THEN** `a1` has task `T-003.1` and `a2` has task `T-002.2`

### S-005.2.4 · A subagent with no launch has no assignment {edge}
- **GIVEN** a subagent `a9` with no launch record
- **WHEN** the log is summarized
- **THEN** `a9` has description `null`, task `null` and feature `null`, and still appears in `agents`

### S-005.2.5 · The session lists every feature in flight {happy}
- **GIVEN** a main-agent step that mentions `T-003.4` and a running subagent assigned `T-002.2`
- **WHEN** the log is summarized
- **THEN** the session's `features` is `["F-002", "F-003"]`

### S-005.2.6 · A finished subagent leaves the features in flight {edge}
- **GIVEN** the log of S-005.2.5 followed by a `subagent-stop` record for that subagent at 18:05:00Z
- **WHEN** the log is summarized
- **THEN** the session's `features` is `["F-003"]` and the subagent's `stopped_at` is `2026-10-18T18:05:00Z`

## ST-005.3 · The viewer shows each subagent's task
**Intent:** As the developer, I want each lane in the live view to name its task and feature, so that I can follow parallel subagents across features.

### S-005.3.1 · A lane is named after its assignment {happy}
- **GIVEN** a live session whose subagent has description "Build T-002.2 heading recognizer" and task `T-002.2`
- **WHEN** the live strip renders
- **THEN** that lane shows "Build T-002.2 heading recognizer" and an ID chip for `T-002.2`

### S-005.3.2 · The session row shows every feature in flight {happy}
- **GIVEN** a live session with `features` `["F-002", "F-003"]`
- **WHEN** the live strip renders
- **THEN** its row has ID chips for `F-002` and `F-003`

### S-005.3.3 · A lane without an assignment shows its type {edge}
- **GIVEN** a subagent with description `null` and type `general-purpose`
- **WHEN** the live strip renders
- **THEN** its lane is named "general-purpose" and has no ID chip

### S-005.3.4 · A finished subagent's lane says so {edge}
- **GIVEN** a subagent whose `stopped_at` is set
- **WHEN** the live strip renders
- **THEN** its lane shows "Finished" instead of a live dot

## ST-005.4 · Wake-ups follow every feature in flight
**Intent:** As an orchestrator, I want to be woken when you act on any feature my subagents are building, so that I don't miss your decisions while I wait on them.

### S-005.4.1 · You act on a feature a subagent is building {happy}
- **GIVEN** a session whose main agent last mentioned `F-003`, a running subagent assigned `T-002.2`, and a change request you logged on `F-002` after the wake cursor
- **WHEN** the post-tool-use hook runs
- **THEN** it exits 2 and its stderr names `F-002`

### S-005.4.2 · You act on a feature nobody is working on {negative}
- **GIVEN** the same session and a change request you logged on `F-004`
- **WHEN** the post-tool-use hook runs
- **THEN** it exits 0 with no output
