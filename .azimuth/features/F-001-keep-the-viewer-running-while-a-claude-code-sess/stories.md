# F-001: Stories

## ST-001.1 · The viewer stays up while a session is open
**Intent:** As the developer, I want the viewer to keep running while my Claude Code session is open so that its URL works whenever I look, even after a long break.

### S-001.1.1 · An open session keeps the viewer past its idle limit {happy}
- **GIVEN** a viewer with no open page and no requests, and a live log whose latest start record has the process ID of a running process and no end record after it
- **WHEN** the idle limit passes
- **THEN** the viewer still answers `GET /api/health` with 200

### S-001.1.2 · An ended session no longer counts {edge}
- **GIVEN** a live log with a start record carrying a running process ID, followed by an end record
- **WHEN** the session is checked
- **THEN** it is not open

### S-001.1.3 · A session whose process is gone no longer counts {edge}
- **GIVEN** a live log whose latest process ID belongs to no running process, with no end record
- **WHEN** the session is checked
- **THEN** it is not open

### S-001.1.4 · A session without a process ID keeps the old rule {edge}
- **GIVEN** a live log with no process ID, last written longer ago than the idle limit
- **WHEN** the session is checked
- **THEN** it is not open, and the same log written within the idle limit is open

## ST-001.2 · Hooks record Claude Code's process
**Intent:** As the viewer, I want to know which process each Claude Code session runs in so that I can tell whether the session is still open.

### S-001.2.1 · SessionStart records the process ID {happy}
- **GIVEN** `CLAUDE_PID=4242` in the hook's environment
- **WHEN** the SessionStart hook runs
- **THEN** the session's start record has `pid: 4242`

### S-001.2.2 · UserPromptSubmit records the process ID {happy}
- **GIVEN** `CLAUDE_PID=4242` in the hook's environment
- **WHEN** the UserPromptSubmit hook runs
- **THEN** the session's prompt record has `pid: 4242`

### S-001.2.3 · No usable process ID {negative}
- **GIVEN** `CLAUDE_PID` unset, or set to `abc`
- **WHEN** the SessionStart hook runs
- **THEN** the start record has no `pid` field

## ST-001.3 · The next prompt brings a stopped viewer back
**Intent:** As the developer, I want my next prompt to restart a viewer that stopped so that I never have to start it by hand during a session.

### S-001.3.1 · The prompt hook starts the viewer without waiting {happy}
- **GIVEN** a project with `viewer.autostart: true`
- **WHEN** the UserPromptSubmit hook runs
- **THEN** it asks for the project's viewer with a wait of 0 ms

### S-001.3.2 · Autostart turned off {negative}
- **GIVEN** `viewer.autostart: false`, or `AZIMUTH_NO_VIEWER=1`
- **WHEN** the UserPromptSubmit hook runs
- **THEN** it doesn't ask for the viewer
