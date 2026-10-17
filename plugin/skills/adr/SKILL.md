---
name: adr
description: Record an architecture decision in Azimuth as an ADR with context, options, the decision and its consequences, and accept it when the project allows agents to.
argument-hint: "<decision title>"
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# Record a decision

Decision: $ARGUMENTS

1. `azimuth new adr "<title>" --links <F-IDs or T-IDs it affects>`.
2. Fill the sections from what you know: **Context** (the forces and constraints), **Options**
   (two or three, each with trade-offs), **Decision** (one, stated plainly), **Consequences**
   (what becomes easier and harder). If it settles an answered question, add the question to
   `resolves`; if it replaces a decision, set `supersedes`.
3. `azimuth check <ADR-ID>`.
4. `azimuth move <ADR-ID> accepted`. The CLI accepts it automatically when the project allows;
   if it refuses (manual acceptance, an unanswered question, or replacing a decision the user
   made), leave it proposed and tell the user it's waiting for them.
5. If it supersedes an older decision: `azimuth move <old ADR> superseded --by <ADR-ID>`.
