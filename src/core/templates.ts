import { inlineYaml } from "./frontmatter";

/**
 * Built-in templates. `azimuth init` copies them into `.azimuth/templates/` so a project can
 * adjust them; `azimuth new` prefers the project's copy. Placeholders are `{{name}}`.
 */

export const TEMPLATES: Record<string, string> = {
  "feature/feature.md": `---
id: {{id}}
title: {{title_yaml}}
summary: {{summary_yaml}}
status: idea
priority: {{priority}}
size: null
mode: {{mode}}
milestone: {{milestone}}
depends_on: []
superseded_by: null
tags: []
created: {{date}}
updated: {{date}}
---
# {{id}}: {{title}}

## Objective
{{summary}}

## Out of scope

## Integration points

## Invariants

## Assumptions
`,
  "feature/log.md": `# Log

## {{now}} · {{actor}} · note{{session}}
Captured as an idea.
`,
  "feature/impact.md": `---
files:
  - path: src/example.ts
    change: create # create | modify | read | test
    note: What this file is responsible for
---
# {{id}}: Impact map
`,
  "feature/stories.md": `# {{id}}: Stories

## ST-{{num}}.1 · <story title>
**Intent:** As <actor>, I want <capability> so that <outcome>.

### S-{{num}}.1.1 · <happy path> {happy}
- **GIVEN** <exact initial state>
- **WHEN** <trigger>
- **THEN** <exact result: value, state, status code>

### S-{{num}}.1.2 · <failure case> {negative}
- **GIVEN** <invalid input or state>
- **WHEN** <trigger>
- **THEN** <exact error variant, status code or rollback>
`,
  "feature/contract.md": `---
language: {{language}}
---
# {{id}}: Contract

## Data structures

## Public signatures

## Errors

## State transitions
None.
`,
  "feature/plan.md": `---
tasks:
  - id: T-{{num}}.1
    title: Types & scaffolding
    status: todo
    after: []
    covers: []
    files: []
    verify: <typecheck command>
    note: null
---
# {{id}}: Plan
`,
  "milestone.md": `---
id: {{id}}
title: {{title_yaml}}
status: planned
target: null
released_at: null
goal: {{summary_yaml}}
---
# {{id}}: {{title}}

## Scope notes
`,
  "decision.md": `---
id: {{id}}
title: {{title_yaml}}
status: proposed
date: {{date}}
supersedes: null
superseded_by: null
resolves: []
links: []
decided_by: null
decided_at: null
review_ack_at: null
---
# {{id}}: {{title}}

## Context

## Options

## Decision

## Consequences
`,
  "question.md": `---
id: {{id}}
title: {{title_yaml}}
status: open
feature: {{feature}}
blocking: {{blocking}}
raised_by: {{raised_by}}
raised_at: {{now}}
links: []
options: []
answer: null
resolution: null
---
## Context
{{summary}}
`,
  "issue-bug.md": `---
id: {{id}}
type: bug
title: {{title_yaml}}
status: open
severity: medium
likelihood: null
impact: null
links: []
files: []
found_by: {{raised_by}}
created: {{date}}
resolved_at: null
---
## Repro

## Expected

## Actual
`,
  "issue-debt.md": `---
id: {{id}}
type: debt
title: {{title_yaml}}
status: open
severity: medium
likelihood: null
impact: null
links: []
files: []
found_by: {{raised_by}}
created: {{date}}
resolved_at: null
---
## Problem

## Proposed fix
`,
  "issue-risk.md": `---
id: {{id}}
type: risk
title: {{title_yaml}}
status: open
severity: null
likelihood: medium
impact: medium
links: []
files: []
found_by: {{raised_by}}
created: {{date}}
resolved_at: null
---
## Scenario

## Mitigation
`,
  "session.md": `---
id: {{id}}
agent: {{agent}}
skill: {{skill}}
started_at: {{now}}
ended_at: null
goal: {{title_yaml}}
touched: []
commits: []
raised: []
---
## Summary

## Handoff
`,
};

/** Fills `{{name}}`; `{{name_yaml}}` inserts the value quoted for a YAML frontmatter line. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key.endsWith("_yaml")) {
      const raw = values[key.slice(0, -5)];
      return raw === undefined ? match : inlineYaml(raw);
    }
    return values[key] ?? match;
  });
}
