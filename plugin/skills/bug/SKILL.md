---
name: bug
description: File a bug, piece of tech debt or risk in Azimuth with severity (or likelihood and impact), the affected files and links.
argument-hint: "<title> [bug|debt|risk]"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# File an issue

Issue: $ARGUMENTS

1. Pick the type: `bug` (wrong behaviour), `debt` (works but costs us), `risk` (might go wrong).
2. `azimuth new issue "<title>" --type <type> --files <paths> --links <IDs>`; for bugs and debt
   add `--severity low|medium|high|critical` (your proposal; the user can change it).
3. Fill the body: bug → Repro, Expected, Actual; debt → Problem, Proposed fix; risk →
   Scenario, Mitigation (set `likelihood` and `impact` in the frontmatter).
4. `azimuth check <ID>` and report the ID.
