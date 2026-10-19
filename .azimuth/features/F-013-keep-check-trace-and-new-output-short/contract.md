---
language: typescript
---
# F-013: Contract

## Data structures

```ts
// src/cli/commands/read.ts: new options (parseArgs config); everything else unchanged.
export const check: Command; // usage: "check [ID…] [--warnings] [--json]"
//   options: { json: { type: "boolean" }, warnings: { type: "boolean" } }
export const trace: Command; // usage: "trace [F-ID] [--all] [--json]"
//   options: { json: { type: "boolean" }, all: { type: "boolean" } }

// src/cli/commands/write.ts: usage and options of `new` are unchanged.
export const newCommand: Command;

// test/helpers/cli.ts
export interface CliResult {
  /** What main() returned (0 success, 1 refused, 2 usage, 3 internal). */
  code: number;
  out: string;
  err: string;
}
```

Text output (no colour when stdout is not a terminal or `NO_COLOR` is set):

```text
# azimuth check            (no ID, no --warnings, at least one problem)
<CODE> <file>[:line] [ref]          one entry per error, as today
  <message>
<W> warnings: <n> <CODE>, <n> <CODE>, … (--warnings lists them)    only when W > 0
                                                                   empty line
<E> errors, <W> warnings
#   codes ordered by count descending, ties by code ascending; counts are not pluralised.
#   With any ID or --warnings: every problem as today. --json: every problem, as today.
#   No problems: "No problems." Exit 1 when the listed problems include an error, else 0.

# azimuth trace            (without --all)
S-… <status> <title>
    <file>: <name>                  marker references only
<N> mention-only references hidden (--all shows them)              last line, only when N > 0
#   --all: every reference, mention-only ones suffixed " (mention)", no hint line.
#   --json: unchanged, every reference with its confidence.

# azimuth new <kind> …     (without --json)
stdout: <ID>\n
stderr: created <path>[, <path>…]\n      or "nothing new\n" when `new spec` wrote no file
#   --json: stdout {"id", "files"} pretty-printed as today; nothing on stderr.
```

## Public signatures

```ts
// test/helpers/cli.ts
/**
 * Runs `azimuth <args> --root <root>` in-process through main() and captures what it writes to
 * process.stdout and process.stderr. Runs with AZIMUTH_ACTOR=agent, NO_COLOR=1 and
 * AZIMUTH_NO_VIEWER=1, and without AZIMUTH_SESSION, AZIMUTH_CLAUDE_SESSION or
 * CLAUDE_CODE_SESSION_ID unless `env` sets them; restores the environment afterwards.
 */
export function runCli(
  root: string,
  args: string[],
  env?: Record<string, string>,
): Promise<CliResult>;

// src/cli/commands/write.ts (module-internal)
/** Prints a new record's ID on stdout and its files on stderr, or `{id, files}` with --json. */
function reportCreated(rt: Runtime, created: Created): void;
// newCommand.run order: create the record → reportCreated → recordInSession. An error thrown by
// recordInSession propagates to main(), which reports it after the ID is already on stdout.

// src/core/create.ts (module-internal; exported signatures of createDecision, createQuestion and
// createIssue are unchanged)
function createRecord(
  root: string,
  kind: CounterKind,
  folder: string,
  name: (id: string) => string,
  templateName: string,
  values: Record<string, string>,
  /** Frontmatter fields applied with updateFrontmatter() to the filled template before the
   *  exclusive write, inside allocateId's callback. Replaces patch(), which is removed. */
  updates?: Record<string, unknown>,
): Created;
```

## Errors

No new error types or codes.

- `new`: when `recordInSession` throws after the ID was printed, `main()` reports it as today:
  `✗ <message>` on stderr and exit 1 for an `AzimuthError` (e.g. `busy`: "Another Azimuth command
  is writing; try again in a moment."), `azimuth crashed: <stack>` and exit 3 for anything else.
  The created file and the ID stay.
- `new`: when the frontmatter fields can't be applied (`updateFrontmatter` throws "Cannot edit
  invalid frontmatter: …", only possible with an invalid project template), nothing is written,
  the ID high-water mark doesn't move, stdout stays empty and the exit code is 3, as for any
  internal error.
- `check` and `trace`: unchanged.

## State transitions
None.
