# Azimuth

Project management for codebases built with AI agents. Agents specify, build and verify features
through gated lifecycles; you set direction, answer their questions and review what they decided,
in a live local viewer. Everything lives in your repository under `.azimuth/`.

- **Specs before code.** Each feature has a context, an impact map, BDD stories, a contract and a
  task graph, validated by `azimuth check`.
- **Gates, not discipline.** Statuses change only through `azimuth move`, which checks the gate:
  committed specs with negative cases and covered scenarios before approval, passing verify runs and
  a reconciled architecture before done.
- **Agent-first.** Agents approve specs and accept their own decisions when every check passes;
  you review automatic decisions in your inbox and answer the questions only you can.
- **Live.** Claude Code hooks record what agents do; the viewer updates as they work and tells
  them when you answer or request changes.
- **Offline viewer**, served locally or exported as a single HTML file.

```sh
pnpm install && pnpm build
claude plugin marketplace add "$PWD" && claude plugin install azimuth@azimuth
```

Then, in Claude Code inside a repository: `/azimuth:init`, then `/azimuth:ship "<feature>"`.

Read the [documentation](docs/README.md), starting with [Getting started](docs/getting-started.md).
