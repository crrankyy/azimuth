---
updated: 2026-10-18
terms:
  - term: Index
    definition: The JSON snapshot buildIndex derives from .azimuth/, git, tests and live logs; the viewer renders only this
    aliases: [index.json]
  - term: Gate
    definition: The checks a status change must pass (G-APPROVE, G-START, G-VERIFY, G-DONE, G-RELEASE)
  - term: Autonomy
    definition: The config policy that lets agents approve specs and accept their own ADRs
    aliases: [auto-approval]
  - term: Live session
    definition: A Claude Code session's append-only activity log under .azimuth/cache/live/, shown in the viewer while it is active
  - term: Inbox
    definition: Everything that needs the owner, ordered by urgency, including automatic approvals to review
  - term: rev
    definition: A hash of the index content (or an entity's file) used to push only real changes and to detect stale writes
---
# Glossary
