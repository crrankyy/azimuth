---
name: ship
description: Take a feature request all the way through Azimuth - capture, spec, approval, build and close-out - stopping only for blocking questions or refusals that need the user.
argument-hint: "<feature request or F-NNN>"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
  - Bash(git *)
---

# Ship a feature end to end

Request: $ARGUMENTS

Run the stages in order by invoking each stage's skill (for example `/azimuth:spec F-NNN`) and
following its instructions in full; don't read the skills' files from the plugin folder:

1. **Capture** (`/azimuth:idea`) unless the argument is already an F-ID.
2. **Spec** (`/azimuth:spec`): write, check, draft, commit and approve. If the CLI refuses
   approval because it is manual, or a blocking question is open, stop here and tell the user
   exactly what they need to do in the viewer.
3. **Build** (`/azimuth:build`): every task, test-first, with verify runs and progress logs.
4. **Close out** (`/azimuth:verify`): verify at HEAD, as-built, architecture, done.

Between stages, re-read `azimuth show <F-ID> --brief`; act on change requests and answers the
user left in the meantime before moving on. Every stage runs in this Claude Code session's one
Azimuth session: each skill's `azimuth session start` adds its goal to it, and the plugin closes
it when the Claude Code session ends. Finish with a short report: what shipped, commits,
follow-ups, and anything waiting for the user.
