/**
 * Expected index for the Hookline fixture: the viewer brief's §12 sample data, extended with the
 * v0.1 contract additions (file paths, approval bookkeeping, gate check ids, log transitions,
 * autonomy, live). Generated once from the brief; edit by hand from here on.
 */
import type { Index } from "../../../src/core/types";

export const expectedIndex = {
  "schema": 1,
  "generated_at": "2026-10-18T12:05:00Z",
  "mode": "live",
  "rev": "",
  "server": null,
  "project": {
    "name": "Hookline",
    "description": "Self-hosted webhook delivery service. It accepts events over HTTP, signs them and delivers them to subscriber endpoints with retries.",
    "mode": "brownfield",
    "stack": [
      "TypeScript",
      "Node 22",
      "Fastify",
      "SQLite",
      "Vitest",
      "pnpm"
    ],
    "commands": {
      "build": "pnpm build",
      "typecheck": "pnpm tsc --noEmit",
      "test": "pnpm vitest run",
      "lint": "pnpm eslint .",
      "format": "pnpm prettier --check ."
    },
    "git": {
      "branch": "main",
      "head": "9f3c2e1",
      "dirty": false
    },
    "autonomy": {
      "approve_specs": "manual",
      "accept_adrs": "manual",
      "questions": "ask",
      "strict": false
    },
    "editor_url": null,
    "root": null,
    "shared_files": []
  },
  "knowledge": {
    "vision": {
      "file": ".azimuth/project/vision.md",
      "updated": "2026-09-02",
      "body": "## Problem\nTeams that emit webhooks keep rebuilding the same delivery plumbing: signing, retries, dead-lettering and replay.\n\n## Users\nBackend developers who self-host and want delivery guarantees without a SaaS.\n\n## Goals\n- At-least-once delivery with bounded retries\n- Every attempt can be inspected\n- One binary and one SQLite file\n\n## Non-goals\n- Exactly-once delivery\n- A hosted multi-tenant service\n\n## Success metrics\n- 0 events lost in a 72 h chaos test\n- p99 delivery latency under 500 ms at 100 deliveries/s\n\n## Constraints\n- Runs on a single 1 vCPU / 512 MB host"
    },
    "architecture": {
      "file": ".azimuth/project/architecture.md",
      "updated": "2026-09-27",
      "reconciled_at": "4b7d0a2",
      "commits_since_reconciled": 11,
      "modules": [
        {
          "name": "api",
          "path": "src/api",
          "responsibility": "HTTP ingestion and management endpoints",
          "depends_on": [
            "store",
            "config"
          ]
        },
        {
          "name": "store",
          "path": "src/store",
          "responsibility": "SQLite schema, migrations and queries",
          "depends_on": []
        },
        {
          "name": "signing",
          "path": "src/signing",
          "responsibility": "HMAC-SHA256 payload signatures",
          "depends_on": []
        },
        {
          "name": "worker",
          "path": "src/worker",
          "responsibility": "Lease due deliveries, send them, record attempts",
          "depends_on": [
            "store",
            "signing",
            "config"
          ]
        },
        {
          "name": "config",
          "path": "src/config",
          "responsibility": "Load and validate configuration",
          "depends_on": []
        }
      ],
      "body": "## Overview\nA Fastify API writes events and deliveries to SQLite. A worker loop leases due deliveries, signs and sends them, and records the outcome.\n\n## Boundaries & invariants\n- Only `store` runs SQL.\n- The worker never holds a transaction open during an HTTP request.\n- Payload bytes are signed exactly as they are sent."
    },
    "conventions": {
      "file": ".azimuth/project/conventions.md",
      "updated": "2026-09-03",
      "body": "## Error handling\nDomain code returns `Result<T, E>`. Only the HTTP boundary throws.\n\n## Testing\nVitest. Test titles start with the scenario ID. Unit tests make no network calls; use `fakeReceiver()`.\n\n## Naming\nFiles are kebab-case, types PascalCase, functions camelCase.\n\n## Commits\nConventional Commits with `Refs:` trailers."
    },
    "glossary": [
      {
        "term": "Delivery",
        "definition": "One event destined for one endpoint, tracked until it succeeds or gives up",
        "aliases": [
          "deliveries"
        ]
      },
      {
        "term": "Attempt",
        "definition": "A single HTTP request made for a delivery",
        "aliases": [
          "attempt_count"
        ]
      },
      {
        "term": "Endpoint",
        "definition": "A subscriber URL with its signing secret and event filter",
        "aliases": []
      },
      {
        "term": "Lease",
        "definition": "A time-bounded claim a worker holds on an in-flight delivery",
        "aliases": [
          "lease_until"
        ]
      },
      {
        "term": "Dead letter",
        "definition": "A delivery that ran out of retries, kept with its full attempt history",
        "aliases": [
          "DLQ"
        ]
      }
    ],
    "glossary_file": ".azimuth/project/glossary.md"
  },
  "milestones": [
    {
      "id": "M-01",
      "title": "Foundations",
      "status": "released",
      "target": "2026-09-30",
      "released_at": "2026-09-28",
      "goal": "Accept events and deliver each one, signed, to registered endpoints.",
      "features": [
        "F-001",
        "F-002",
        "F-003"
      ],
      "progress": {
        "done": 3,
        "total": 3,
        "by_status": {
          "done": 3
        }
      },
      "file": ".azimuth/milestones/M-01-foundations.md"
    },
    {
      "id": "M-02",
      "title": "Reliable delivery",
      "status": "active",
      "target": "2026-11-15",
      "released_at": null,
      "goal": "No event is silently lost. Failures retry with backoff, then dead-letter with their full history.",
      "features": [
        "F-004",
        "F-005",
        "F-006",
        "F-007"
      ],
      "progress": {
        "done": 0,
        "total": 3,
        "by_status": {
          "approved": 1,
          "in-progress": 1,
          "verifying": 1
        }
      },
      "file": ".azimuth/milestones/M-02-reliable-delivery.md"
    },
    {
      "id": "M-03",
      "title": "Operability",
      "status": "planned",
      "target": "2026-12-20",
      "released_at": null,
      "goal": "Operators can replay, rate-limit and observe deliveries.",
      "features": [
        "F-008",
        "F-009",
        "F-010",
        "F-012"
      ],
      "progress": {
        "done": 0,
        "total": 3,
        "by_status": {
          "idea": 1,
          "draft": 2
        }
      },
      "file": ".azimuth/milestones/M-03-operability.md"
    }
  ],
  "features": [
    {
      "id": "F-001",
      "slug": "endpoint-registry",
      "title": "Endpoint registry",
      "summary": "Register, update and remove subscriber endpoints with their secrets and event filters.",
      "status": "done",
      "priority": "P0",
      "size": "S",
      "mode": "greenfield",
      "milestone": "M-01",
      "depends_on": [],
      "superseded_by": null,
      "tags": [
        "api"
      ],
      "created": "2026-09-02",
      "updated": "2026-09-10",
      "approved_at": "2026-09-03",
      "approved_by": "you",
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-001-endpoint-registry/",
      "derived": {
        "blocks": [
          "F-002",
          "F-003",
          "F-011"
        ],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 3,
          "total": 3
        },
        "coverage": {
          "passing": 6,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 6
        },
        "next_gate": null,
        "last_activity": "2026-09-10T16:20:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-002",
      "slug": "payload-signing",
      "title": "Payload signing",
      "summary": "Sign every payload with HMAC-SHA256 using the endpoint secret, with a timestamp that stops replays.",
      "status": "done",
      "priority": "P0",
      "size": "S",
      "mode": "greenfield",
      "milestone": "M-01",
      "depends_on": [
        "F-001"
      ],
      "superseded_by": null,
      "tags": [
        "security"
      ],
      "created": "2026-09-05",
      "updated": "2026-09-16",
      "approved_at": "2026-09-06",
      "approved_by": "you",
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-002-payload-signing/",
      "derived": {
        "blocks": [
          "F-003"
        ],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 3,
          "total": 3
        },
        "coverage": {
          "passing": 5,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 5
        },
        "next_gate": null,
        "last_activity": "2026-09-16T11:05:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-003",
      "slug": "delivery-worker",
      "title": "Delivery worker",
      "summary": "Lease due deliveries, sign and send them, and record the outcome.",
      "status": "done",
      "priority": "P0",
      "size": "M",
      "mode": "greenfield",
      "milestone": "M-01",
      "depends_on": [
        "F-001",
        "F-002"
      ],
      "superseded_by": null,
      "tags": [
        "delivery"
      ],
      "created": "2026-09-08",
      "updated": "2026-09-27",
      "approved_at": "2026-09-10",
      "approved_by": "you",
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-003-delivery-worker/",
      "derived": {
        "blocks": [
          "F-005",
          "F-007",
          "F-009"
        ],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 7,
          "total": 7
        },
        "coverage": {
          "passing": 9,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 9
        },
        "next_gate": null,
        "last_activity": "2026-09-27T17:20:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-004",
      "slug": "cron-retry-sweep",
      "title": "Cron retry sweep",
      "summary": "Retry failed deliveries with a periodic sweep job.",
      "status": "superseded",
      "priority": "P1",
      "size": "M",
      "mode": "brownfield",
      "milestone": "M-02",
      "depends_on": [
        "F-003"
      ],
      "superseded_by": "F-005",
      "tags": [
        "delivery"
      ],
      "created": "2026-09-29",
      "updated": "2026-10-07",
      "approved_at": null,
      "approved_by": null,
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-004-cron-retry-sweep/",
      "derived": {
        "blocks": [],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 5
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 6,
          "total": 6
        },
        "next_gate": null,
        "last_activity": "2026-10-07T11:00:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-005",
      "slug": "retry-backoff",
      "title": "Retry with exponential backoff",
      "summary": "Retry failed deliveries with exponential backoff and full jitter until they succeed or reach maxAttempts.",
      "status": "in-progress",
      "priority": "P0",
      "size": "M",
      "mode": "brownfield",
      "milestone": "M-02",
      "depends_on": [
        "F-003"
      ],
      "superseded_by": null,
      "tags": [
        "delivery",
        "reliability"
      ],
      "created": "2026-10-02",
      "updated": "2026-10-18",
      "approved_at": "2026-10-09",
      "approved_by": "you",
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-005-retry-backoff/",
      "derived": {
        "blocks": [
          "F-006"
        ],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 3,
          "total": 6
        },
        "coverage": {
          "passing": 4,
          "failing": 1,
          "not_run": 0,
          "untested": 3,
          "total": 8
        },
        "next_gate": {
          "to": "verifying",
          "checks": [
            {
              "id": "verify.tasks-done",
              "rule": "Every task is done or skipped",
              "ok": false,
              "detail": "3 of 6 tasks still open"
            },
            {
              "id": "verify.no-blocking-questions",
              "rule": "No open blocking questions",
              "ok": true
            }
          ]
        },
        "last_activity": "2026-10-18T11:58:00Z",
        "file_conflicts": [
          {
            "path": "src/worker/deliver.ts",
            "with": "F-007"
          }
        ],
        "approval_changes": []
      },
      "detail": {
        "context": {
          "objective": "Retry failed deliveries with exponential backoff and full jitter until they succeed or reach `maxAttempts`, so a receiver's temporary outage never loses events.",
          "out_of_scope": "- What happens after the last attempt: dead-lettering is F-006\n- Per-endpoint rate limits (F-009)\n- Manual replay (F-008)",
          "integration_points": "- `src/worker/deliver.ts` calls `decideRetry()` after every attempt\n- The `deliveries` table gains `attempt_count`, `next_attempt_at`, `state` and `lease_until`\n- Emits `delivery.exhausted` on the internal event bus (consumed by F-006)",
          "invariants": "- At most one in-flight attempt per delivery\n- Each attempt is counted exactly once, even across worker crashes\n- 4xx responses are never retried, except 408 and 429\n- `next_attempt_at` is never more than `maxDelayMs` in the future",
          "assumptions": "- Default policy: base 2 s, factor 2, max delay 1 h, 8 attempts\n- `Retry-After` is honoured, capped at `maxDelayMs`\n- Jitter strategy: full jitter, per ADR-0003 (from Q-0001)"
        },
        "impact": [
          {
            "path": "src/retry/types.ts",
            "change": "create",
            "note": "RetryPolicy, RetryDecision, DeliveryState, InvalidRetryPolicy",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/retry/policy.ts",
            "change": "create",
            "note": "decideRetry(), computeDelay(), parseRetryPolicy()",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/retry/classify.ts",
            "change": "create",
            "note": "classifyResponse(): retryable or permanent",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/store/migrations/004_retry.sql",
            "change": "create",
            "note": "attempt_count, next_attempt_at, state, lease_until columns",
            "symbols": [],
            "exists": false
          },
          {
            "path": "src/worker/deliver.ts",
            "change": "modify",
            "note": "Call decideRetry() after each attempt and persist the schedule",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/config/schema.ts",
            "change": "modify",
            "note": "retry section with validation",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/store/db.ts",
            "change": "read",
            "note": "withTx() transaction helper",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/retry/backoff.test.ts",
            "change": "test",
            "note": "Backoff and Retry-After scenarios",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/retry/classify.test.ts",
            "change": "test",
            "note": "Response classification scenarios",
            "symbols": [],
            "exists": true
          },
          {
            "path": "src/retry/policy.test.ts",
            "change": "test",
            "note": "Exhaustion and policy validation scenarios",
            "symbols": [],
            "exists": true
          },
          {
            "path": "test/worker.crash.test.ts",
            "change": "test",
            "note": "Lease expiry and crash recovery",
            "symbols": [],
            "exists": false
          }
        ],
        "stories": [
          {
            "id": "ST-005.1",
            "title": "Schedule a retry after a failed attempt",
            "intent": "As the delivery worker, I want each failed attempt turned into a scheduled retry so that transient receiver failures don't lose events.",
            "scenarios": [
              {
                "id": "S-005.1.1",
                "title": "Retries a 503 with exponential backoff",
                "kind": "happy",
                "given": "Delivery d1 is in_flight with attempt_count 2, policy {base 2 s, factor 2, maxDelay 1 h}, and jitter seeded to return its upper bound",
                "when": "The receiver responds 503",
                "then": "d1.state = scheduled_retry, attempt_count = 3, next_attempt_at = now + 8 s",
                "coverage": {
                  "status": "passing",
                  "tests": [
                    {
                      "file": "src/retry/backoff.test.ts",
                      "name": "S-005.1.1 retries a 503 with exponential backoff",
                      "status": "passing",
                      "confidence": "marker",
                      "committed": true
                    }
                  ]
                }
              },
              {
                "id": "S-005.1.2",
                "title": "Does not retry a 400",
                "kind": "negative",
                "given": "Delivery d1 is in_flight with attempt_count 1",
                "when": "The receiver responds 400",
                "then": "d1.state = failed_permanent, next_attempt_at = null, and no retry is scheduled",
                "coverage": {
                  "status": "passing",
                  "tests": [
                    {
                      "file": "src/retry/classify.test.ts",
                      "name": "S-005.1.2 does not retry a 400",
                      "status": "passing",
                      "confidence": "marker",
                      "committed": true
                    }
                  ]
                }
              },
              {
                "id": "S-005.1.3",
                "title": "Honours Retry-After",
                "kind": "edge",
                "given": "Delivery d1 is in_flight with attempt_count 1",
                "when": "The receiver responds 429 with `Retry-After: 120`",
                "then": "d1.state = scheduled_retry, next_attempt_at = now + 120 s, and no jitter is applied",
                "coverage": {
                  "status": "passing",
                  "tests": [
                    {
                      "file": "src/retry/backoff.test.ts",
                      "name": "S-005.1.3 honours Retry-After",
                      "status": "passing",
                      "confidence": "marker",
                      "committed": true
                    }
                  ]
                }
              },
              {
                "id": "S-005.1.4",
                "title": "Caps Retry-After at maxDelay",
                "kind": "edge",
                "given": "Policy maxDelay = 1 h and delivery d1 is in_flight",
                "when": "The receiver responds 503 with `Retry-After: 86400`",
                "then": "next_attempt_at = now + 1 h",
                "coverage": {
                  "status": "passing",
                  "tests": [
                    {
                      "file": "src/retry/backoff.test.ts",
                      "name": "S-005.1.4 caps Retry-After at maxDelay",
                      "status": "passing",
                      "confidence": "marker",
                      "committed": true
                    }
                  ]
                }
              }
            ]
          },
          {
            "id": "ST-005.2",
            "title": "Stop retrying after maxAttempts",
            "intent": "As an operator, I want deliveries to stop after a bounded number of attempts so that dead receivers don't consume worker capacity forever.",
            "scenarios": [
              {
                "id": "S-005.2.1",
                "title": "Marks a delivery exhausted",
                "kind": "happy",
                "given": "Delivery d1 is in_flight with attempt_count 7 and maxAttempts 8",
                "when": "The receiver responds 500",
                "then": "d1.state = exhausted, attempt_count = 8, and `delivery.exhausted` is emitted once with {deliveryId: d1, attempts: 8}",
                "coverage": {
                  "status": "failing",
                  "tests": [
                    {
                      "file": "src/retry/policy.test.ts",
                      "name": "S-005.2.1 marks delivery exhausted after maxAttempts",
                      "status": "failing",
                      "confidence": "marker",
                      "committed": true
                    }
                  ]
                }
              },
              {
                "id": "S-005.2.2",
                "title": "Rejects an invalid policy at startup",
                "kind": "negative",
                "given": "Config sets retry.maxAttempts = 0",
                "when": "The service starts",
                "then": "Startup fails with InvalidRetryPolicy {field: \"maxAttempts\", reason: \"must be >= 1\"} and exit code 78",
                "coverage": {
                  "status": "untested",
                  "tests": []
                }
              }
            ]
          },
          {
            "id": "ST-005.3",
            "title": "Survive worker crashes",
            "intent": "As the delivery worker, I want attempts leased so that a crash mid-attempt neither loses the delivery nor counts the attempt twice.",
            "scenarios": [
              {
                "id": "S-005.3.1",
                "title": "Completes an attempt within its lease",
                "kind": "happy",
                "given": "Delivery d1 is leased by worker w1 with lease_until = now + 30 s",
                "when": "The receiver responds 200 after 2 s",
                "then": "d1.state = succeeded, lease_until = null, and exactly one attempt row exists",
                "coverage": {
                  "status": "untested",
                  "tests": []
                }
              },
              {
                "id": "S-005.3.2",
                "title": "Recovers an expired lease",
                "kind": "edge",
                "given": "Delivery d1 is in_flight with lease_until in the past and attempt_count 3, and its worker process is gone",
                "when": "Another worker polls for due deliveries",
                "then": "d1 is re-leased and attempted, attempt_count becomes 4 (not 5), and exactly one attempt row exists for attempt 4",
                "coverage": {
                  "status": "untested",
                  "tests": []
                }
              }
            ]
          }
        ],
        "contract": {
          "language": "typescript",
          "sections": [
            {
              "title": "Data structures",
              "body": "```ts\nexport type DeliveryState =\n  | \"pending\" | \"in_flight\" | \"scheduled_retry\"\n  | \"succeeded\" | \"failed_permanent\" | \"exhausted\";\n\nexport interface RetryPolicy {\n  baseDelayMs: number;  // default 2_000\n  factor: number;       // default 2\n  maxDelayMs: number;   // default 3_600_000\n  maxAttempts: number;  // default 8, must be >= 1\n}\n\nexport type RetryDecision =\n  | { kind: \"retry\"; at: Date; attempt: number }\n  | { kind: \"permanent\"; reason: string }\n  | { kind: \"exhausted\"; attempts: number };\n```"
            },
            {
              "title": "Public signatures",
              "body": "```ts\nexport function classifyResponse(status: number, headers: Headers): \"retryable\" | \"permanent\";\n\nexport function computeDelay(\n  policy: RetryPolicy, attempt: number, retryAfterMs: number | null, rand: () => number,\n): number;\n\nexport function decideRetry(\n  policy: RetryPolicy, attempt: number, result: AttemptResult, now: Date, rand?: () => number,\n): RetryDecision;\n\nexport function parseRetryPolicy(raw: unknown): Result<RetryPolicy, InvalidRetryPolicy>;\n```"
            },
            {
              "title": "Errors",
              "body": "```ts\nexport interface InvalidRetryPolicy {\n  kind: \"InvalidRetryPolicy\";\n  field: keyof RetryPolicy;\n  reason: string;\n}\n```"
            },
            {
              "title": "State transitions",
              "body": "```mermaid\nstateDiagram-v2\n  [*] --> pending\n  pending --> in_flight: leased\n  in_flight --> succeeded: 2xx\n  in_flight --> scheduled_retry: retryable, attempts < max\n  in_flight --> failed_permanent: permanent\n  in_flight --> exhausted: retryable, attempts = max\n  in_flight --> in_flight: lease expired, re-leased\n  scheduled_retry --> in_flight: next_attempt_at reached\n  succeeded --> [*]\n  failed_permanent --> [*]\n  exhausted --> [*]\n```"
            }
          ]
        },
        "tasks": [
          {
            "id": "T-005.1",
            "title": "Types & scaffolding",
            "status": "done",
            "after": [],
            "covers": [],
            "files": [
              "src/retry/types.ts",
              "src/retry/policy.ts",
              "src/retry/classify.ts"
            ],
            "verify": "pnpm tsc --noEmit",
            "note": null,
            "last_run": {
              "run": "R-0139",
              "ok": true,
              "at": "2026-10-10T14:03:00Z"
            }
          },
          {
            "id": "T-005.2",
            "title": "Backoff with full jitter (red → green)",
            "status": "done",
            "after": [
              "T-005.1"
            ],
            "covers": [
              "S-005.1.1",
              "S-005.1.3",
              "S-005.1.4"
            ],
            "files": [
              "src/retry/policy.ts",
              "src/retry/backoff.test.ts"
            ],
            "verify": "pnpm vitest run src/retry/backoff.test.ts",
            "note": null,
            "last_run": {
              "run": "R-0140",
              "ok": true,
              "at": "2026-10-18T11:13:00Z"
            }
          },
          {
            "id": "T-005.3",
            "title": "Response classification (red → green)",
            "status": "done",
            "after": [
              "T-005.1"
            ],
            "covers": [
              "S-005.1.2"
            ],
            "files": [
              "src/retry/classify.ts",
              "src/retry/classify.test.ts"
            ],
            "verify": "pnpm vitest run src/retry/classify.test.ts",
            "note": null,
            "last_run": {
              "run": "R-0141",
              "ok": true,
              "at": "2026-10-18T11:32:00Z"
            }
          },
          {
            "id": "T-005.4",
            "title": "Exhaustion & policy validation (red → green)",
            "status": "in-progress",
            "after": [
              "T-005.2"
            ],
            "covers": [
              "S-005.2.1",
              "S-005.2.2"
            ],
            "files": [
              "src/retry/policy.ts",
              "src/config/schema.ts",
              "src/retry/policy.test.ts"
            ],
            "verify": "pnpm vitest run src/retry/policy.test.ts",
            "note": null,
            "last_run": {
              "run": "R-0142",
              "ok": false,
              "at": "2026-10-18T11:56:00Z"
            }
          },
          {
            "id": "T-005.5",
            "title": "Lease-based crash safety",
            "status": "blocked",
            "after": [
              "T-005.1"
            ],
            "covers": [
              "S-005.3.1",
              "S-005.3.2"
            ],
            "files": [
              "src/store/migrations/004_retry.sql",
              "src/worker/deliver.ts",
              "test/worker.crash.test.ts"
            ],
            "verify": "pnpm vitest run test/worker.crash.test.ts",
            "note": "Waiting for a decision on ADR-0004 (lease timeout).",
            "last_run": null
          },
          {
            "id": "T-005.6",
            "title": "Wire into the delivery worker & full verification",
            "status": "todo",
            "after": [
              "T-005.3",
              "T-005.4",
              "T-005.5"
            ],
            "covers": [],
            "files": [
              "src/worker/deliver.ts"
            ],
            "verify": "pnpm tsc --noEmit && pnpm vitest run && pnpm eslint .",
            "note": null,
            "last_run": null
          }
        ],
        "log": [
          {
            "at": "2026-10-07T11:00:00Z",
            "actor": "agent",
            "type": "transition",
            "session": "SES-20261007-1010",
            "body": "idea → draft. Spec written: 3 stories, 8 scenarios, 6 tasks. Raised Q-0001 (blocking).",
            "transition": {
              "from": "idea",
              "to": "draft"
            },
            "auto": false
          },
          {
            "at": "2026-10-07T12:30:00Z",
            "actor": "you",
            "type": "note",
            "session": null,
            "body": "Answered Q-0001: full jitter.",
            "transition": null,
            "auto": false
          },
          {
            "at": "2026-10-08T09:00:00Z",
            "actor": "you",
            "type": "review",
            "session": null,
            "body": "S-005.2.2 should name the exit code for an invalid policy, not just the error.",
            "transition": null,
            "auto": false
          },
          {
            "at": "2026-10-09T08:40:00Z",
            "actor": "you",
            "type": "transition",
            "session": null,
            "body": "draft → approved.",
            "transition": {
              "from": "draft",
              "to": "approved"
            },
            "auto": false
          },
          {
            "at": "2026-10-10T13:50:00Z",
            "actor": "agent",
            "type": "transition",
            "session": null,
            "body": "approved → in-progress.",
            "transition": {
              "from": "approved",
              "to": "in-progress"
            },
            "auto": false
          },
          {
            "at": "2026-10-18T11:58:00Z",
            "actor": "agent",
            "type": "note",
            "session": "SES-20261018-1100",
            "body": "T-005.2 and T-005.3 done. T-005.4 is red as expected. Raised Q-0002 and proposed ADR-0004. T-005.5 is blocked until ADR-0004 is decided.",
            "transition": null,
            "auto": false
          }
        ],
        "as_built": null,
        "notes": null
      }
    },
    {
      "id": "F-006",
      "slug": "dead-letter-queue",
      "title": "Dead-letter queue",
      "summary": "Move exhausted deliveries to a dead-letter queue with their full attempt history.",
      "status": "approved",
      "priority": "P1",
      "size": "M",
      "mode": "brownfield",
      "milestone": "M-02",
      "depends_on": [
        "F-005"
      ],
      "superseded_by": null,
      "tags": [
        "reliability"
      ],
      "created": "2026-10-05",
      "updated": "2026-10-16",
      "approved_at": "2026-10-11",
      "approved_by": "you",
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-006-dead-letter-queue/",
      "derived": {
        "blocks": [
          "F-008"
        ],
        "blocked_by": [
          {
            "kind": "dependency",
            "id": "F-005"
          }
        ],
        "modified_since_approval": true,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 5
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 6,
          "total": 6
        },
        "next_gate": {
          "to": "in-progress",
          "checks": [
            {
              "id": "start.spec-unchanged",
              "rule": "Spec unchanged since approval",
              "ok": false,
              "detail": "contract.md changed on 2026-10-16 (commit e02b6f7)"
            },
            {
              "id": "start.dependencies-done",
              "rule": "Every dependency is done",
              "ok": false,
              "detail": "F-005 is in-progress"
            }
          ]
        },
        "last_activity": "2026-10-16T13:40:00Z",
        "file_conflicts": [],
        "approval_changes": [
          {
            "path": ".azimuth/features/F-006-dead-letter-queue/contract.md",
            "commit": "e02b6f7",
            "at": "2026-10-16T13:38:00Z",
            "session": "SES-20261016-1320"
          }
        ]
      }
    },
    {
      "id": "F-007",
      "slug": "attempt-log",
      "title": "Delivery attempt log",
      "summary": "Record every delivery attempt and expose the history at GET /deliveries/:id/attempts.",
      "status": "verifying",
      "priority": "P1",
      "size": "M",
      "mode": "brownfield",
      "milestone": "M-02",
      "depends_on": [
        "F-003"
      ],
      "superseded_by": null,
      "tags": [
        "observability"
      ],
      "created": "2026-10-03",
      "updated": "2026-10-17",
      "approved_at": "2026-10-06",
      "approved_by": "you",
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-007-attempt-log/",
      "derived": {
        "blocks": [
          "F-008",
          "F-010"
        ],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 4,
          "total": 4
        },
        "coverage": {
          "passing": 5,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 5
        },
        "next_gate": {
          "to": "done",
          "checks": [
            {
              "id": "done.verify-passed",
              "rule": "Latest verify run of every task passed at HEAD",
              "ok": false,
              "detail": "T-007.4 failed at b13f5c0: 2 lint errors"
            },
            {
              "id": "done.scenarios-passing",
              "rule": "Every scenario has a passing test",
              "ok": true,
              "detail": "5 of 5"
            },
            {
              "id": "done.placeholders-settled",
              "rule": "Every placeholder value settled",
              "ok": true
            },
            {
              "id": "done.as-built",
              "rule": "as-built.md written",
              "ok": false
            },
            {
              "id": "done.architecture-reconciled",
              "rule": "Architecture reconciled after the feature's last commit",
              "ok": false,
              "detail": "Reconciled at 4b7d0a2, 11 commits behind"
            }
          ]
        },
        "last_activity": "2026-10-17T16:40:00Z",
        "file_conflicts": [
          {
            "path": "src/worker/deliver.ts",
            "with": "F-005"
          }
        ],
        "approval_changes": []
      }
    },
    {
      "id": "F-008",
      "slug": "delivery-replay",
      "title": "Delivery replay API",
      "summary": "Re-send any past delivery on demand through POST /deliveries/:id/replay.",
      "status": "draft",
      "priority": "P1",
      "size": "M",
      "mode": "brownfield",
      "milestone": "M-03",
      "depends_on": [
        "F-006",
        "F-007"
      ],
      "superseded_by": null,
      "tags": [
        "api"
      ],
      "created": "2026-10-14",
      "updated": "2026-10-18",
      "approved_at": null,
      "approved_by": null,
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-008-delivery-replay/",
      "derived": {
        "blocks": [],
        "blocked_by": [
          {
            "kind": "question",
            "id": "Q-0003"
          }
        ],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 6
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 8,
          "total": 8
        },
        "next_gate": {
          "to": "approved",
          "checks": [
            {
              "id": "approve.no-errors",
              "rule": "No check errors in this feature",
              "ok": true
            },
            {
              "id": "approve.story-kinds",
              "rule": "Every story has a happy and a negative or edge scenario",
              "ok": true
            },
            {
              "id": "approve.gwt",
              "rule": "Every scenario has GIVEN, WHEN and THEN",
              "ok": true
            },
            {
              "id": "approve.scenarios-covered",
              "rule": "Every scenario is covered by a task",
              "ok": true
            },
            {
              "id": "approve.verify-commands",
              "rule": "Every task has a verify command",
              "ok": true
            },
            {
              "id": "approve.committed",
              "rule": "Spec files committed",
              "ok": true
            },
            {
              "id": "approve.no-blocking-questions",
              "rule": "No open blocking questions",
              "ok": false,
              "detail": "Q-0003 is open"
            },
            {
              "id": "approve.dependencies",
              "rule": "Dependencies exist and form no cycle",
              "ok": true
            },
            {
              "id": "approve.size",
              "rule": "Size is not XL",
              "ok": true
            }
          ]
        },
        "last_activity": "2026-10-18T10:20:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-009",
      "slug": "endpoint-rate-limits",
      "title": "Per-endpoint rate limiting",
      "summary": "Cap deliveries per endpoint per second so slow receivers aren't overwhelmed.",
      "status": "draft",
      "priority": "P2",
      "size": "M",
      "mode": "brownfield",
      "milestone": "M-03",
      "depends_on": [
        "F-003"
      ],
      "superseded_by": null,
      "tags": [
        "api",
        "reliability"
      ],
      "created": "2026-10-12",
      "updated": "2026-10-17",
      "approved_at": null,
      "approved_by": null,
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-009-endpoint-rate-limits/",
      "derived": {
        "blocks": [],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 5
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 7,
          "total": 7
        },
        "next_gate": {
          "to": "approved",
          "checks": [
            {
              "id": "approve.no-errors",
              "rule": "No check errors in this feature",
              "ok": true
            },
            {
              "id": "approve.story-kinds",
              "rule": "Every story has a happy and a negative or edge scenario",
              "ok": true
            },
            {
              "id": "approve.gwt",
              "rule": "Every scenario has GIVEN, WHEN and THEN",
              "ok": true
            },
            {
              "id": "approve.scenarios-covered",
              "rule": "Every scenario is covered by a task",
              "ok": true
            },
            {
              "id": "approve.verify-commands",
              "rule": "Every task has a verify command",
              "ok": true
            },
            {
              "id": "approve.committed",
              "rule": "Spec files committed",
              "ok": true
            },
            {
              "id": "approve.no-blocking-questions",
              "rule": "No open blocking questions",
              "ok": true
            },
            {
              "id": "approve.dependencies",
              "rule": "Dependencies exist and form no cycle",
              "ok": true
            },
            {
              "id": "approve.size",
              "rule": "Size is not XL",
              "ok": true
            }
          ]
        },
        "last_activity": "2026-10-17T09:48:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-010",
      "slug": "prometheus-metrics",
      "title": "Prometheus metrics",
      "summary": "Expose delivery, attempt and queue-depth metrics in Prometheus format.",
      "status": "idea",
      "priority": "P2",
      "size": null,
      "mode": "brownfield",
      "milestone": "M-03",
      "depends_on": [
        "F-007"
      ],
      "superseded_by": null,
      "tags": [
        "observability"
      ],
      "created": "2026-10-10",
      "updated": "2026-10-10",
      "approved_at": null,
      "approved_by": null,
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-010-prometheus-metrics/",
      "derived": {
        "blocks": [],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 0
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 0
        },
        "next_gate": {
          "to": "draft",
          "checks": [
            {
              "id": "draft.spec-files",
              "rule": "Spec files written (impact, stories, contract, plan)",
              "ok": false,
              "detail": "Run /azimuth:spec F-010"
            }
          ]
        },
        "last_activity": "2026-10-10T09:00:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-011",
      "slug": "tenant-api-keys",
      "title": "Multi-tenant API keys",
      "summary": "Scope endpoints and deliveries to tenants with per-tenant API keys.",
      "status": "deferred",
      "priority": "P3",
      "size": "L",
      "mode": "brownfield",
      "milestone": null,
      "depends_on": [
        "F-001"
      ],
      "superseded_by": null,
      "tags": [
        "security"
      ],
      "created": "2026-09-20",
      "updated": "2026-10-01",
      "approved_at": null,
      "approved_by": null,
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-011-tenant-api-keys/",
      "derived": {
        "blocks": [],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 0
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 0
        },
        "next_gate": null,
        "last_activity": "2026-10-01T15:00:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    },
    {
      "id": "F-012",
      "slug": "dead-letter-email",
      "title": "Email alerts on dead letters",
      "summary": "Email the operator when a delivery is dead-lettered.",
      "status": "cancelled",
      "priority": "P3",
      "size": "S",
      "mode": "brownfield",
      "milestone": "M-03",
      "depends_on": [
        "F-006"
      ],
      "superseded_by": null,
      "tags": [
        "observability"
      ],
      "created": "2026-10-07",
      "updated": "2026-10-13",
      "approved_at": null,
      "approved_by": null,
      "approved_commit": null,
      "review_ack_at": null,
      "file": ".azimuth/features/F-012-dead-letter-email/",
      "derived": {
        "blocks": [],
        "blocked_by": [],
        "modified_since_approval": false,
        "stale": false,
        "progress": {
          "done": 0,
          "total": 0
        },
        "coverage": {
          "passing": 0,
          "failing": 0,
          "not_run": 0,
          "untested": 0,
          "total": 0
        },
        "next_gate": null,
        "last_activity": "2026-10-13T08:30:00Z",
        "file_conflicts": [],
        "approval_changes": []
      }
    }
  ],
  "decisions": [
    {
      "id": "ADR-0001",
      "title": "SQLite (better-sqlite3) as the delivery store",
      "status": "accepted",
      "date": "2026-09-02",
      "supersedes": null,
      "superseded_by": null,
      "resolves": [],
      "links": [
        "F-003"
      ],
      "body": {
        "context": "Hookline must run as one process on a small host, with durable queues and no external services.",
        "options": "- **SQLite (better-sqlite3)**: no ops, synchronous API, one writer at a time.\n- **Postgres**: concurrent writers, but another service to run.\n- **Redis streams**: fast, but durability depends on configuration.",
        "decision": "Use SQLite in WAL mode through better-sqlite3. All SQL lives in `src/store`.",
        "consequences": "- Single-writer throughput is a ceiling (see RISK-0001).\n- A backup is a file copy."
      },
      "decided_by": "you",
      "decided_at": "2026-09-02T10:00:00Z",
      "decision_note": null,
      "review_ack_at": null,
      "file": ".azimuth/decisions/ADR-0001-sqlite-delivery-store.md"
    },
    {
      "id": "ADR-0002",
      "title": "Retry failed deliveries with a periodic cron sweep",
      "status": "superseded",
      "date": "2026-09-29",
      "supersedes": null,
      "superseded_by": "ADR-0003",
      "resolves": [],
      "links": [
        "F-004"
      ],
      "body": {
        "context": "Failed deliveries need to be retried.",
        "options": "- Sweep failed deliveries every 30 s\n- Schedule each delivery individually",
        "decision": "Sweep failed deliveries every 30 seconds and retry them.",
        "consequences": "- Retries bunch up at sweep boundaries.\n- Simple to build."
      },
      "decided_by": "you",
      "decided_at": "2026-09-29T10:00:00Z",
      "decision_note": null,
      "review_ack_at": null,
      "file": ".azimuth/decisions/ADR-0002-cron-retry-sweep.md"
    },
    {
      "id": "ADR-0003",
      "title": "Per-delivery next_attempt_at with full-jitter exponential backoff",
      "status": "accepted",
      "date": "2026-10-07",
      "supersedes": "ADR-0002",
      "superseded_by": null,
      "resolves": [
        "Q-0001"
      ],
      "links": [
        "F-005",
        "F-004"
      ],
      "body": {
        "context": "A sweep sends retries in bursts and can't honour `Retry-After`. Q-0001 settled on full jitter.",
        "options": "- **Keep the sweep** (ADR-0002)\n- **Per-delivery `next_attempt_at`, full jitter**: spreads load and honours `Retry-After`\n- **Per-delivery, no jitter**: predictable, but receivers get thundering herds after an outage",
        "decision": "Each delivery stores `next_attempt_at`. delay = random(0, min(maxDelay, base · factorⁿ⁻¹)). `Retry-After` overrides it, capped at maxDelay.",
        "consequences": "- F-004 is superseded by F-005.\n- Tests need a seedable random source."
      },
      "decided_by": "you",
      "decided_at": "2026-10-07T12:35:00Z",
      "decision_note": null,
      "review_ack_at": null,
      "file": ".azimuth/decisions/ADR-0003-full-jitter-backoff.md"
    },
    {
      "id": "ADR-0004",
      "title": "30-second lease for in-flight attempts",
      "status": "proposed",
      "date": "2026-10-18",
      "supersedes": null,
      "superseded_by": null,
      "resolves": [],
      "links": [
        "F-005",
        "T-005.5"
      ],
      "body": {
        "context": "T-005.5 needs a lease so a crashed worker's delivery gets picked up again. Too short and slow receivers get sent the same delivery twice; too long and recovery is slow. The HTTP timeout is 15 s.",
        "options": "- **10 s**: fast recovery, but double-sends whenever a receiver takes more than 10 s\n- **30 s**: double the HTTP timeout; recovery within 30 s\n- **120 s**: safest against double-sends; slow recovery",
        "decision": "Use a 30 s lease that is never renewed, because an attempt can't outlive the 15 s HTTP timeout.",
        "consequences": "- A crashed worker delays its deliveries by up to 30 s.\n- The HTTP timeout must stay below the lease; config validation enforces it."
      },
      "decided_by": null,
      "decided_at": null,
      "decision_note": null,
      "review_ack_at": null,
      "file": ".azimuth/decisions/ADR-0004-lease-timeout.md"
    }
  ],
  "questions": [
    {
      "id": "Q-0001",
      "title": "Which jitter strategy should retry backoff use?",
      "status": "answered",
      "blocking": true,
      "feature": "F-005",
      "raised_by": "SES-20261007-1010",
      "raised_at": "2026-10-07T10:40:00Z",
      "links": [],
      "context": "Without jitter, the retries from a single outage all arrive together. The strategies trade predictability for spread.",
      "options": [
        {
          "key": "full",
          "label": "Full jitter",
          "detail": "delay = random(0, base · 2ⁿ). Best spread, least predictable.",
          "recommended": true
        },
        {
          "key": "equal",
          "label": "Equal jitter",
          "detail": "Half fixed, half random. Guarantees a minimum wait.",
          "recommended": false
        },
        {
          "key": "decorrelated",
          "label": "Decorrelated jitter",
          "detail": "Each delay depends on the previous one. Good spread, harder to test.",
          "recommended": false
        }
      ],
      "answer": {
        "option": "full",
        "text": "Full jitter. Spreading load after an outage matters more than predictability.",
        "answered_at": "2026-10-07T12:30:00Z",
        "by": "you"
      },
      "resolution": {
        "kind": "adr",
        "ref": "ADR-0003"
      },
      "review_ack_at": null,
      "file": ".azimuth/questions/Q-0001.md"
    },
    {
      "id": "Q-0002",
      "title": "Should 429 responses count toward maxAttempts?",
      "status": "open",
      "blocking": false,
      "feature": "F-005",
      "raised_by": "SES-20261018-1100",
      "raised_at": "2026-10-18T11:45:00Z",
      "links": [
        "S-005.1.3",
        "T-005.4"
      ],
      "context": "A receiver that answers 429 is alive but busy. If 429s count, a long throttle can exhaust a delivery that would have succeeded. The current code counts them.",
      "options": [
        {
          "key": "count",
          "label": "Count them",
          "detail": "Simplest; matches the current code. A throttled endpoint can exhaust deliveries.",
          "recommended": false
        },
        {
          "key": "window",
          "label": "Don't count them; cap the total retry window at 24 h",
          "detail": "Throttling never exhausts a delivery, and the window still bounds it.",
          "recommended": true
        },
        {
          "key": "retry-after",
          "label": "Count them only when there is no Retry-After header",
          "detail": "Rewards receivers that send Retry-After. Harder to explain.",
          "recommended": false
        }
      ],
      "answer": null,
      "resolution": null,
      "review_ack_at": null,
      "file": ".azimuth/questions/Q-0002.md"
    },
    {
      "id": "Q-0003",
      "title": "Re-sign replayed payloads with the current or the original secret?",
      "status": "open",
      "blocking": true,
      "feature": "F-008",
      "raised_by": "SES-20261018-0930",
      "raised_at": "2026-10-18T10:12:00Z",
      "links": [
        "F-002"
      ],
      "context": "Replay re-sends a stored payload. If the endpoint's secret was rotated in the meantime, the two choices give receivers different results, and one of them changes F-002.",
      "options": [
        {
          "key": "current",
          "label": "Sign with the endpoint's current secret",
          "detail": "Still works after rotation, because receivers verify with the secret they have today.",
          "recommended": true
        },
        {
          "key": "original",
          "label": "Sign with the original secret",
          "detail": "Needs secret versions stored (changes F-002). Fails if the old secret was revoked.",
          "recommended": false
        },
        {
          "key": "caller",
          "label": "Let the caller choose per replay request",
          "detail": "Most flexible, but adds a parameter and a test matrix.",
          "recommended": false
        }
      ],
      "answer": null,
      "resolution": null,
      "review_ack_at": null,
      "file": ".azimuth/questions/Q-0003.md"
    }
  ],
  "issues": [
    {
      "id": "BUG-0001",
      "type": "bug",
      "title": "Worker can double-send when SQLite returns SQLITE_BUSY after the request",
      "status": "open",
      "severity": "high",
      "likelihood": null,
      "impact": null,
      "links": [
        "F-003",
        "F-005"
      ],
      "files": [
        "src/worker/deliver.ts"
      ],
      "found_by": "you",
      "created": "2026-10-14",
      "resolved_at": null,
      "body": "## Repro\n1. Run two workers against one database.\n2. Hold a write lock for 6 s during an attempt.\n\n## Expected\nThe attempt is recorded once and not sent again.\n\n## Actual\nThe outcome write fails with SQLITE_BUSY, the lease expires, and the second worker sends the delivery again.",
      "file": ".azimuth/issues/BUG-0001-double-send-on-busy.md"
    },
    {
      "id": "BUG-0002",
      "type": "bug",
      "title": "Endpoint URL validation accepts ftp:// URLs",
      "status": "resolved",
      "severity": "low",
      "likelihood": null,
      "impact": null,
      "links": [
        "F-001"
      ],
      "files": [
        "src/api/endpoints.ts"
      ],
      "found_by": "you",
      "created": "2026-09-12",
      "resolved_at": "2026-09-15",
      "body": "## Repro\nPOST /endpoints with url `ftp://example.test/hook`.\n\n## Expected\n422 with `{field: \"url\", reason: \"must be http or https\"}`.\n\n## Actual\n201 Created.",
      "file": ".azimuth/issues/BUG-0002-ftp-url-accepted.md"
    },
    {
      "id": "DEBT-0001",
      "type": "debt",
      "title": "Delivery worker logs unstructured strings",
      "status": "open",
      "severity": "medium",
      "likelihood": null,
      "impact": null,
      "links": [
        "F-007",
        "F-010"
      ],
      "files": [
        "src/worker/deliver.ts"
      ],
      "found_by": "SES-20261017-1430",
      "created": "2026-10-17",
      "resolved_at": null,
      "body": "## Problem\nThe worker logs with template strings, so attempts can't be correlated by delivery ID.\n\n## Proposed fix\nSwitch to pino with `deliveryId` and `attempt` fields before F-010 adds metrics.",
      "file": ".azimuth/issues/DEBT-0001-unstructured-worker-logs.md"
    },
    {
      "id": "RISK-0001",
      "type": "risk",
      "title": "SQLite write contention above ~200 deliveries/s",
      "status": "open",
      "severity": null,
      "likelihood": "medium",
      "impact": "high",
      "links": [
        "ADR-0001"
      ],
      "files": [
        "src/store/db.ts"
      ],
      "found_by": "you",
      "created": "2026-10-15",
      "resolved_at": null,
      "body": "## Scenario\nA burst of events makes worker and API writes queue behind the single SQLite writer, and delivery latency climbs.\n\n## Mitigation\nBatch attempt writes. Benchmark at 300/s before M-02 ships.",
      "file": ".azimuth/issues/RISK-0001-sqlite-write-contention.md"
    }
  ],
  "sessions": [
    {
      "id": "SES-20261018-1100",
      "agent": "claude-code",
      "skill": "pm-build",
      "started_at": "2026-10-18T11:00:00Z",
      "ended_at": "2026-10-18T11:58:00Z",
      "goal": "Build F-005 tasks T-005.2 to T-005.4",
      "touched": [
        "F-005",
        "T-005.2",
        "T-005.3",
        "T-005.4"
      ],
      "commits": [
        "a41f2b9",
        "6c0e3d8",
        "9f3c2e1"
      ],
      "raised": [
        "Q-0002",
        "ADR-0004"
      ],
      "summary": "T-005.2 and T-005.3 are green. Wrote the red tests for T-005.4, and S-005.2.1 fails as expected. Proposed ADR-0004, because T-005.5 needs a lease timeout.",
      "handoff": "- Next: implement exhaustion in `src/retry/policy.ts` to turn S-005.2.1 green, then add a test for S-005.2.2.\n- T-005.5 waits for ADR-0004 to be accepted.\n- Q-0002 changes how T-005.4 counts attempts. The code currently counts 429s; adjust if the answer differs.\n- F-007 also edits `src/worker/deliver.ts`. Rebase after it lands.",
      "goals": "",
      "notes": "",
      "file": ".azimuth/sessions/SES-20261018-1100.md"
    },
    {
      "id": "SES-20261018-0930",
      "agent": "claude-code",
      "skill": "pm-spec",
      "started_at": "2026-10-18T09:30:00Z",
      "ended_at": "2026-10-18T10:25:00Z",
      "goal": "Write the F-008 spec",
      "touched": [
        "F-008"
      ],
      "commits": [
        "2f9c7a0"
      ],
      "raised": [
        "Q-0003"
      ],
      "summary": "Drafted F-008: 3 stories, 8 scenarios, 6 tasks. The signing behaviour for replays depends on Q-0003.",
      "handoff": "- Blocked on Q-0003. Once it's answered, update S-008.2.1 to S-008.2.3 and `ReplayRequest` in the contract.\n- S-008.2.2 has a vague THEN that will be fixed with the same update.",
      "goals": "",
      "notes": "",
      "file": ".azimuth/sessions/SES-20261018-0930.md"
    },
    {
      "id": "SES-20261017-1430",
      "agent": "claude-code",
      "skill": "pm-build",
      "started_at": "2026-10-17T14:30:00Z",
      "ended_at": "2026-10-17T16:45:00Z",
      "goal": "Build F-007",
      "touched": [
        "F-007",
        "T-007.1",
        "T-007.2",
        "T-007.3",
        "T-007.4"
      ],
      "commits": [
        "7d2a9e4",
        "b13f5c0"
      ],
      "raised": [
        "DEBT-0001"
      ],
      "summary": "Finished T-007.1 to T-007.4 and moved F-007 to verifying. All 5 scenarios pass, but T-007.4's lint step fails with 2 floating promises in `src/api/attempts.ts`.",
      "handoff": "- Fix the two `no-floating-promises` errors, then run `azimuth verify F-007`.\n- Then write as-built.md and reconcile architecture.md (add the attempts table to the store notes).",
      "goals": "",
      "notes": "",
      "file": ".azimuth/sessions/SES-20261017-1430.md"
    },
    {
      "id": "SES-20261017-0915",
      "agent": "claude-code",
      "skill": "pm-spec",
      "started_at": "2026-10-17T09:15:00Z",
      "ended_at": "2026-10-17T09:48:00Z",
      "goal": "Write the F-009 spec",
      "touched": [
        "F-009"
      ],
      "commits": [
        "5aa1c93"
      ],
      "raised": [],
      "summary": "Specified per-endpoint token-bucket limits: 3 stories, 7 scenarios, 5 tasks. Every approval check passes.",
      "handoff": "- Ready for your approval.\n- If F-005 lands first, T-009.3 must read `next_attempt_at` rather than the old sweep.",
      "goals": "",
      "notes": "",
      "file": ".azimuth/sessions/SES-20261017-0915.md"
    },
    {
      "id": "SES-20261016-1320",
      "agent": "claude-code",
      "skill": "pm-spec",
      "started_at": "2026-10-16T13:20:00Z",
      "ended_at": "2026-10-16T13:40:00Z",
      "goal": "Add attempt history to the F-006 contract",
      "touched": [
        "F-006"
      ],
      "commits": [
        "e02b6f7"
      ],
      "raised": [],
      "summary": "Added `attempts: AttemptRecord[]` to `DeadLetter` so operators can see why a delivery died. This changes an approved contract.",
      "handoff": "- F-006 needs re-approval before work starts.\n- It reuses F-007's AttemptRecord type; keep the two in sync.",
      "goals": "",
      "notes": "",
      "file": ".azimuth/sessions/SES-20261016-1320.md"
    },
    {
      "id": "SES-20261007-1010",
      "agent": "claude-code",
      "skill": "pm-spec",
      "started_at": "2026-10-07T10:10:00Z",
      "ended_at": "2026-10-07T11:02:00Z",
      "goal": "Write the F-005 spec",
      "touched": [
        "F-005",
        "F-004"
      ],
      "commits": [
        "c81e0d4"
      ],
      "raised": [
        "Q-0001"
      ],
      "summary": "Wrote the F-005 spec: 3 stories, 8 scenarios, 6 tasks. Recommended superseding F-004, because per-delivery scheduling makes the sweep unnecessary.",
      "handoff": "- Q-0001 (jitter strategy) blocks approval.\n- Once it's answered, write ADR-0003 and mark F-004 superseded.",
      "goals": "",
      "notes": "",
      "file": ".azimuth/sessions/SES-20261007-1010.md"
    }
  ],
  "commits": [
    {
      "sha": "9f3c2e1",
      "at": "2026-10-18T11:55:00Z",
      "actor": "agent",
      "session": "SES-20261018-1100",
      "subject": "test(F-005): add red tests for retry exhaustion",
      "refs": [
        "T-005.4"
      ],
      "files_changed": 2
    },
    {
      "sha": "6c0e3d8",
      "at": "2026-10-18T11:31:00Z",
      "actor": "agent",
      "session": "SES-20261018-1100",
      "subject": "feat(F-005): classify responses as retryable or permanent",
      "refs": [
        "T-005.3"
      ],
      "files_changed": 3
    },
    {
      "sha": "a41f2b9",
      "at": "2026-10-18T11:12:00Z",
      "actor": "agent",
      "session": "SES-20261018-1100",
      "subject": "feat(F-005): exponential backoff with full jitter",
      "refs": [
        "T-005.2"
      ],
      "files_changed": 3
    },
    {
      "sha": "2f9c7a0",
      "at": "2026-10-18T10:20:00Z",
      "actor": "agent",
      "session": "SES-20261018-0930",
      "subject": "docs(F-008): draft delivery replay spec",
      "refs": [
        "F-008"
      ],
      "files_changed": 6
    },
    {
      "sha": "b13f5c0",
      "at": "2026-10-17T16:35:00Z",
      "actor": "agent",
      "session": "SES-20261017-1430",
      "subject": "feat(F-007): expose attempts at GET /deliveries/:id/attempts",
      "refs": [
        "T-007.3",
        "T-007.4"
      ],
      "files_changed": 4
    },
    {
      "sha": "7d2a9e4",
      "at": "2026-10-17T15:10:00Z",
      "actor": "agent",
      "session": "SES-20261017-1430",
      "subject": "feat(F-007): record every delivery attempt",
      "refs": [
        "T-007.1",
        "T-007.2"
      ],
      "files_changed": 5
    },
    {
      "sha": "5aa1c93",
      "at": "2026-10-17T09:45:00Z",
      "actor": "agent",
      "session": "SES-20261017-0915",
      "subject": "docs(F-009): spec per-endpoint rate limiting",
      "refs": [
        "F-009"
      ],
      "files_changed": 6
    },
    {
      "sha": "e02b6f7",
      "at": "2026-10-16T13:38:00Z",
      "actor": "agent",
      "session": "SES-20261016-1320",
      "subject": "docs(F-006): add attempt history to dead-letter contract",
      "refs": [
        "F-006"
      ],
      "files_changed": 1
    },
    {
      "sha": "d5a8f31",
      "at": "2026-10-15T09:05:00Z",
      "actor": "you",
      "session": null,
      "subject": "chore: bump fastify to 5.1",
      "refs": [],
      "files_changed": 2
    },
    {
      "sha": "c2d4e18",
      "at": "2026-10-10T14:02:00Z",
      "actor": "agent",
      "session": null,
      "subject": "feat(F-005): retry policy types and scaffolding",
      "refs": [
        "T-005.1"
      ],
      "files_changed": 3
    },
    {
      "sha": "c81e0d4",
      "at": "2026-10-07T11:00:00Z",
      "actor": "agent",
      "session": "SES-20261007-1010",
      "subject": "docs(F-005): spec retry with exponential backoff",
      "refs": [
        "F-005"
      ],
      "files_changed": 6
    },
    {
      "sha": "4b7d0a2",
      "at": "2026-09-27T17:20:00Z",
      "actor": "agent",
      "session": null,
      "subject": "docs: reconcile architecture after F-003",
      "refs": [
        "F-003"
      ],
      "files_changed": 1
    }
  ],
  "runs": [
    {
      "id": "R-0142",
      "target": "T-005.4",
      "command": "pnpm vitest run src/retry/policy.test.ts",
      "ok": false,
      "exit_code": 1,
      "duration_ms": 2140,
      "at": "2026-10-18T11:56:00Z",
      "commit": "9f3c2e1",
      "output_tail": " FAIL  src/retry/policy.test.ts > S-005.2.1 marks delivery exhausted after maxAttempts\nAssertionError: expected 'scheduled_retry' to be 'exhausted'\n  ❯ src/retry/policy.test.ts:41:29\n\n Test Files  1 failed (1)\n      Tests  1 failed | 2 passed (3)",
      "scenarios": [
        {
          "id": "S-005.2.1",
          "status": "failing"
        }
      ],
      "junit": null
    },
    {
      "id": "R-0141",
      "target": "T-005.3",
      "command": "pnpm vitest run src/retry/classify.test.ts",
      "ok": true,
      "exit_code": 0,
      "duration_ms": 1310,
      "at": "2026-10-18T11:32:00Z",
      "commit": "6c0e3d8",
      "output_tail": " ✓ src/retry/classify.test.ts (4 tests) 9ms\n\n Test Files  1 passed (1)\n      Tests  4 passed (4)",
      "scenarios": [
        {
          "id": "S-005.1.2",
          "status": "passing"
        }
      ],
      "junit": null
    },
    {
      "id": "R-0140",
      "target": "T-005.2",
      "command": "pnpm vitest run src/retry/backoff.test.ts",
      "ok": true,
      "exit_code": 0,
      "duration_ms": 1280,
      "at": "2026-10-18T11:13:00Z",
      "commit": "a41f2b9",
      "output_tail": " ✓ src/retry/backoff.test.ts (6 tests) 12ms\n\n Test Files  1 passed (1)\n      Tests  6 passed (6)",
      "scenarios": [
        {
          "id": "S-005.1.1",
          "status": "passing"
        },
        {
          "id": "S-005.1.3",
          "status": "passing"
        },
        {
          "id": "S-005.1.4",
          "status": "passing"
        }
      ],
      "junit": null
    },
    {
      "id": "R-0139",
      "target": "T-005.1",
      "command": "pnpm tsc --noEmit",
      "ok": true,
      "exit_code": 0,
      "duration_ms": 4870,
      "at": "2026-10-10T14:03:00Z",
      "commit": "c2d4e18",
      "output_tail": "",
      "scenarios": [],
      "junit": null
    },
    {
      "id": "R-0138",
      "target": "T-007.4",
      "command": "pnpm vitest run && pnpm eslint .",
      "ok": false,
      "exit_code": 1,
      "duration_ms": 8420,
      "at": "2026-10-17T16:40:00Z",
      "commit": "b13f5c0",
      "output_tail": " Test Files  9 passed (9)\n      Tests  41 passed (41)\n\n/src/api/attempts.ts\n  18:5  error  Promises must be awaited  @typescript-eslint/no-floating-promises\n  31:5  error  Promises must be awaited  @typescript-eslint/no-floating-promises\n\n✖ 2 problems (2 errors, 0 warnings)",
      "scenarios": [
        {
          "id": "S-007.1.1",
          "status": "passing"
        },
        {
          "id": "S-007.1.2",
          "status": "passing"
        },
        {
          "id": "S-007.1.3",
          "status": "passing"
        },
        {
          "id": "S-007.2.1",
          "status": "passing"
        },
        {
          "id": "S-007.2.2",
          "status": "passing"
        }
      ],
      "junit": null
    },
    {
      "id": "R-0137",
      "target": "T-007.3",
      "command": "pnpm vitest run src/api/attempts.test.ts",
      "ok": true,
      "exit_code": 0,
      "duration_ms": 1650,
      "at": "2026-10-17T16:36:00Z",
      "commit": "b13f5c0",
      "output_tail": " ✓ src/api/attempts.test.ts (3 tests) 21ms\n\n Test Files  1 passed (1)\n      Tests  3 passed (3)",
      "scenarios": [
        {
          "id": "S-007.2.1",
          "status": "passing"
        },
        {
          "id": "S-007.2.2",
          "status": "passing"
        }
      ],
      "junit": null
    }
  ],
  "live": [],
  "inbox": [
    {
      "kind": "answer-question",
      "ref": "Q-0003",
      "title": "Re-sign replayed payloads with the current or the original secret?",
      "detail": "Blocking: F-008 can't be approved until this is answered.",
      "since": "2026-10-18T10:12:00Z",
      "urgency": "high"
    },
    {
      "kind": "failing-verify",
      "ref": "F-007",
      "title": "T-007.4 verify failed",
      "detail": "pnpm eslint . reported 2 errors in src/api/attempts.ts (run R-0138).",
      "since": "2026-10-17T16:40:00Z",
      "urgency": "high"
    },
    {
      "kind": "reapprove-spec",
      "ref": "F-006",
      "title": "Dead-letter queue changed since you approved it",
      "detail": "contract.md was edited on 2026-10-16 by SES-20261016-1320.",
      "since": "2026-10-16T13:38:00Z",
      "urgency": "high"
    },
    {
      "kind": "answer-question",
      "ref": "Q-0002",
      "title": "Should 429 responses count toward maxAttempts?",
      "detail": "Affects T-005.4 in F-005. Not blocking.",
      "since": "2026-10-18T11:45:00Z",
      "urgency": "normal"
    },
    {
      "kind": "approve-spec",
      "ref": "F-009",
      "title": "Per-endpoint rate limiting is ready for approval",
      "detail": "All 9 approval checks pass. 3 stories, 7 scenarios, 5 tasks.",
      "since": "2026-10-17T09:48:00Z",
      "urgency": "normal"
    },
    {
      "kind": "review-adr",
      "ref": "ADR-0004",
      "title": "30-second lease for in-flight attempts",
      "detail": "Proposed by SES-20261018-1100. T-005.5 is blocked until it's decided.",
      "since": "2026-10-18T11:30:00Z",
      "urgency": "normal"
    },
    {
      "kind": "check-errors",
      "ref": null,
      "title": "1 validation error",
      "detail": "RISK-0002 has an invalid likelihood and was left out of the index.",
      "since": "2026-10-15T09:10:00Z",
      "urgency": "normal"
    }
  ],
  "problems": [
    {
      "code": "E-SCHEMA",
      "severity": "error",
      "file": ".azimuth/issues/RISK-0002-memory-growth.md",
      "line": 6,
      "ref": null,
      "message": "likelihood must be low, medium or high (got \"med\"). RISK-0002 was left out of the index."
    },
    {
      "code": "W-FILE-CONFLICT",
      "severity": "warning",
      "file": ".azimuth/features/F-005-retry-backoff/impact.md",
      "line": null,
      "ref": "F-005",
      "message": "F-005 and F-007 both modify src/worker/deliver.ts."
    },
    {
      "code": "W-PATH",
      "severity": "warning",
      "file": ".azimuth/features/F-005-retry-backoff/impact.md",
      "line": null,
      "ref": "F-005",
      "message": "src/retry/ is not under any module path in architecture.md."
    },
    {
      "code": "W-VAGUE",
      "severity": "warning",
      "file": ".azimuth/features/F-008-delivery-replay/stories.md",
      "line": 41,
      "ref": "S-008.2.2",
      "message": "THEN \"the request is handled appropriately\" names no status code, error or state."
    },
    {
      "code": "W-ARCH-STALE",
      "severity": "warning",
      "file": ".azimuth/project/architecture.md",
      "line": null,
      "ref": null,
      "message": "11 commits since architecture.md was last reconciled (4b7d0a2)."
    }
  ]
} satisfies Index;
