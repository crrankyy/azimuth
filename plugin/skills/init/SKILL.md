---
name: init
description: Set up Azimuth in the current repository (creates .azimuth/, wires CLAUDE.md) and describe the project's vision, architecture, conventions and glossary from the code and a short interview.
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# Initialize Azimuth

1. If `.azimuth/config.yaml` is missing, run `azimuth init` in the repository root. If it
   exists, run `azimuth init --refresh` to update the protocol and templates only.
2. Open `.azimuth/config.yaml` and confirm the detected commands by running each of them
   (build, typecheck, test, lint). Fix commands that fail or are missing; set
   `project.description`, `stack.display` and `tests.globs` to match the repository.
3. Write the project docs. **Brownfield** (code exists): read the manifests, directory layout,
   entry points, error handling and test setup, and describe what exists. **Greenfield** (empty
   repository): agree the stack, layout and commands with the user, and describe the plan of
   record. Either way, write:
   - `.azimuth/project/architecture.md`: overview, stack, directory layout, commands,
     boundaries and invariants, data flow, and the `modules` list (the comment after
     `modules:` shows an entry), following these rules:
     - A module's `path` covers itself, everything under it, and a file named after it with
       any extension: `src/buffer` covers `src/buffer.rs` and `src/buffer/gap.rs`. Use the
       language's usual layout; never restructure code to suit Azimuth.
     - Every source directory belongs to a module; files at the repository root don't.
     - `depends_on` lists other modules by `name`.
     - `reconciled_at` is the current `git rev-parse --short HEAD`, also for a plan.
   - `.azimuth/project/conventions.md`: how this code handles errors, tests, naming, logging,
     dependencies and commits, with file references. Include how a test names the scenario it
     covers in this language, from `.azimuth/PROTOCOL.md` ("Tests"): a test title starting with
     the ID, `@pytest.mark.scenario("S-…")`, or a `// scenario: S-…` comment above a test whose
     function name is unique in the project.
   - `.azimuth/project/glossary.md`: domain terms used in the code (`terms` list; the comment
     after `terms:` shows an entry).

4. Ask the user, briefly, for the vision: problem, users, goals, non-goals, success metrics,
   constraints. Write their answers to `.azimuth/project/vision.md`. Don't invent goals.
5. Run `azimuth check` and fix every error.
6. Commit everything: `chore(azimuth): initialize project`.
7. Tell the user what was set up, that the viewer starts with each Claude Code session
   (`/azimuth:view` to open it), and suggest `/azimuth:idea` or `/azimuth:ship` next.
