---
name: next
description: Decide what to work on next in an Azimuth project and offer to start it.
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# What next

!`${CLAUDE_PLUGIN_ROOT}/bin/azimuth next`

Summarize the top two or three items above in plain words: what each is, why it's next and
the skill that does it (`/azimuth:build F-…`, `/azimuth:spec F-…`, `/azimuth:verify F-…`). Mention
anything waiting on the user (from `azimuth status --brief`). Offer to start the first item.
