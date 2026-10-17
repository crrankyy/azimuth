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
3. **Brownfield** (code exists): read the manifests, directory layout, entry points, error
   handling and test setup, then write:
   - `.azimuth/project/architecture.md`: overview, stack, directory layout, commands,
     boundaries and invariants, data flow, and the `modules` list (name, path, responsibility,
     depends_on) covering every source directory. Set `reconciled_at` to the current
     `git rev-parse --short HEAD`.
   - `.azimuth/project/conventions.md`: how this code handles errors, tests, naming, logging,
     dependencies and commits, with file references.
   - `.azimuth/project/glossary.md`: domain terms used in the code (`terms` list).

   **Greenfield** (empty repository): agree the stack, layout and commands with the user, then
   write the same files as the plan of record.

4. Ask the user, briefly, for the vision: problem, users, goals, non-goals, success metrics,
   constraints. Write their answers to `.azimuth/project/vision.md`. Don't invent goals.
5. Run `azimuth check` and fix every error.
6. Commit everything: `chore(azimuth): initialize project`.
7. Tell the user what was set up, that the viewer starts with each Claude Code session
   (`/azimuth:view` to open it), and suggest `/azimuth:idea` or `/azimuth:ship` next.
