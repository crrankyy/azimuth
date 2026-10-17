---
name: idea
description: Capture a feature idea in Azimuth as an F-NNN item with a clear objective, without writing a full spec yet.
argument-hint: "<feature title or description>"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# Capture an idea

Request: $ARGUMENTS

1. Check `azimuth status --brief` for an existing feature that already covers this. If one does,
   say so instead of creating a duplicate.
2. Run `azimuth new feature "<short title>" --summary "<one sentence: what and why>"`. Add
   `--milestone M-NN` only if the user named one. Leave priority at the default unless the user
   gave one; the user sets priorities in the viewer.
3. In the new `feature.md`, fill `## Objective` with one or two sentences, and note anything
   the user said is out of scope under `## Out of scope`.
4. Run `azimuth check <F-ID>` and fix errors.
5. Report the ID and suggest `/azimuth:spec <F-ID>` when the user wants to proceed.
