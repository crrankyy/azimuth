---
files:
  - path: src/core/config.ts
    change: modify
    note: verify.shared_paths in Config, DEFAULT_CONFIG (root build manifests) and SHAPE (r.strings())
  - path: src/core/run-scope.ts
    change: create
    note: RunScope, runScope (task files, impact paths, dependency modules, shared globs) and inScope
  - path: src/core/derive.ts
    change: modify
    note: StaleCause and staleCause (the earliest later commit touching a scope); sameCommit exported
  - path: src/core/gates.ts
    change: modify
    note: doneGate uses runScope and staleCause instead of runCurrent and names the commit and path
  - path: src/core/glob.ts
    change: read
    note: globToRegExp, matchesAny and inModule, reused for shared globs and module paths
  - path: src/core/parse/knowledge.ts
    change: read
    note: parseArchitecture gives the modules (name, path, depends_on)
  - path: src/core/parse/feature.ts
    change: read
    note: parsePlan gives task files; parseImpact gives impact paths and their change
  - path: src/core/git.ts
    change: read
    note: readCommits gives the changed files per commit (facts.git.files)
  - path: src/core/brief.ts
    change: read
    note: showBrief prints the done.verify-passed detail unchanged
  - path: test/helpers/project.ts
    change: modify
    note: featureFiles writes a task's files
  - path: test/core/parse.test.ts
    change: test
    note: The verify.shared_paths key
  - path: test/core/run-scope.test.ts
    change: test
    note: Which paths a run depends on
  - path: test/core/analysis.test.ts
    change: test
    note: staleCause, and the done gate's detail (S-002.1.2 and S-002.1.3 take the new detail)
  - path: test/core/git-trace.test.ts
    change: test
    note: Issue 1 reproduced against real git through buildIndex and showBrief
  - path: plugin/skills/verify/SKILL.md
    change: modify
    note: Close-out reruns only the runs the done gate names
  - path: docs/concepts.md
    change: modify
    note: When a verify run counts as current for the done gate
  - path: docs/file-format.md
    change: modify
    note: verify.shared_paths in the config reference
---
# F-006: Impact map

The done gate is the only consumer of run staleness. `run-scope.ts` turns a task, its feature,
the architecture's modules and the config into the set of paths its runs depend on; `staleCause`
in `derive.ts` walks the commits after a run and reports the first one that touches that set.
`gates.ts` joins the two and writes the detail that `move`, `show --brief`, `next` and the index
already print. `docs/cli.md` doesn't describe staleness, so it doesn't change.
