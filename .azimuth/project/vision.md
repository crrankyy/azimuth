---
updated: 2026-10-18
---
# Vision

## Problem
A developer directing AI agents needs project state (knowledge, roadmap, specs, decisions,
questions, issues and agent activity) that both the agents and the developer can read and trust,
kept in the repository instead of a hosted tracker.

## Users
One developer and the AI agents they direct (Claude Code first).

## Goals
- A schema for project knowledge and work, stored as Markdown with YAML frontmatter in the repo.
- A CLI that validates and indexes it, enforces lifecycle gates and runs verification.
- An agent kit (the Claude Code plugin) that drives the feature lifecycle, auto-approving by
  default.
- An offline viewer, live on localhost or exported as one HTML file, that always shows the latest
  state.

## Non-goals
Team features (assignees, permissions), hosted sync, two-way sync with GitHub Issues or Linear,
estimates beyond T-shirt size, multi-repo projects.

## Success metrics

## Constraints
Node 20+, macOS and Linux, offline (no network access from the viewer), pnpm.
