---
files:
  - path: src/core/task-brief.ts
    change: modify
    note: taskBrief adds the shared-file rules, the Conventions section and the closing request; nestHeadings shared by Contract and Conventions; OPEN_RULE and STANDING_RULES lose their report text
  - path: src/core/init.ts
    change: modify
    note: Exports CONVENTIONS_TEMPLATE, the conventions.md text after its frontmatter, which projectDocs writes unchanged
  - path: src/core/glob.ts
    change: read
    note: globToRegExp and matchesAny match the task's files against parallel.shared_files
  - path: src/core/next.ts
    change: read
    note: parallelGroups, the shared_files matching rule the brief follows (paths as written)
  - path: src/core/config.ts
    change: read
    note: parallel.shared_files
  - path: src/core/model.ts
    change: read
    note: Model.knowledge.conventions and Model.config, from loadProject
  - path: src/core/types.ts
    change: read
    note: KnowledgeDoc (file, updated, body)
  - path: src/core/parse/knowledge.ts
    change: read
    note: parseDoc gives the body without frontmatter and title, trimmed, and "" for a missing file
  - path: src/core/sections.ts
    change: read
    note: stripTitle, applied to CONVENTIONS_TEMPLATE as parseDoc applies it to the file
  - path: src/core/placeholders.ts
    change: read
    note: OPEN_PLACEHOLDER in the open-value rule and the closing request's clause
  - path: src/cli/commands/task.ts
    change: read
    note: The brief command prints taskBrief's text and is unchanged
  - path: test/helpers/tree.ts
    change: read
    note: writeTree and MINIMAL_CONFIG for the example project and its config variants
  - path: test/core/task-brief.test.ts
    change: test
    note: Shared-file rules, the Conventions section, the closing request, the full example and determinism; S-009.7.1 and S-009.7.2 follow the new last rules
  - path: test/cli/task.test.ts
    change: read
    note: S-009.8.1 and S-009.8.2 compare the CLI output with taskBrief, so they need no change
  - path: docs/cli.md
    change: modify
    note: The azimuth brief paragraph names the shared-file rules, the Conventions section and the closing request
  - path: plugin/skills/build/SKILL.md
    change: modify
    note: Delegating to subagents, the brief carries the shared-file rules and the report request; the orchestrator adds which other tasks add to each shared file
---
# F-022: Impact map

All the logic is in `src/core/task-brief.ts`, a pure function over the model. `init.ts` gains one
export so that the brief recognises the conventions template `init` really writes, without a
copy of its text. The CLI command is unchanged: it prints whatever `taskBrief` returns. The rest
is one paragraph of `docs/cli.md` and two bullets of the build skill, both files other 0.3
features change in other sections.
