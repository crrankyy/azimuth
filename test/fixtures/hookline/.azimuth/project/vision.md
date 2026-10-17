---
updated: 2026-09-02
---
# Vision

## Problem
Teams that emit webhooks keep rebuilding the same delivery plumbing: signing, retries, dead-lettering and replay.

## Users
Backend developers who self-host and want delivery guarantees without a SaaS.

## Goals
- At-least-once delivery with bounded retries
- Every attempt can be inspected
- One binary and one SQLite file

## Non-goals
- Exactly-once delivery
- A hosted multi-tenant service

## Success metrics
- 0 events lost in a 72 h chaos test
- p99 delivery latency under 500 ms at 100 deliveries/s

## Constraints
- Runs on a single 1 vCPU / 512 MB host
