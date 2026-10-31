// Inside a Claude Code session whose Azimuth hooks run, every command inherits that session's
// variables. Tests that spawn the CLI start from process.env, so the real session would win over
// the one a test sets up: drop them once per test file.
for (const key of [
  "AZIMUTH_ACTOR",
  "AZIMUTH_SESSION",
  "AZIMUTH_CLAUDE_SESSION",
  "CLAUDE_CODE_SESSION_ID",
]) {
  delete process.env[key];
}
