# F-018: Notes

### T-018.1 · 2026-10-20

T-018.3: verifyBatch still stops on any failed prebuild and passes neither prebuild nor timeout_seconds to runVerify; recording { ok: true } after a passing prebuild is its job too, and the runs comment needs updating. T-018.2: replace the prebuild: null placeholder in parseRun (after the waited_ms/ses spreads); neither key has a config test yet. T-018.7: min_free_gb already parses and defaults to 10; r.int(0) gives exactly 'verify.min_free_gb must be a whole number ≥ 0.'. analysis.test.ts and test/fixtures/live/agents.ts take runs from expectedIndex, so the fixture fix covered them.

### T-018.2 · 2026-10-20

T-018.5: run files written without a prebuild key read as null; { ok: false, duration_ms: N } reads as written. Docs (T-018.8): a malformed value is anything but an object with a boolean ok and a number duration_ms ≥ 0; the init comments are S-018.1.4's exact text.

### T-018.7 · 2026-10-20

Docs (T-018.8): doctor also checks free disk space now, though its summary string ('Check that Node, the plugin, hooks and the viewer are wired up') wasn't changed. verify warns only when it has targets; task finish warns after its argument checks, before finishTask.

### T-018.3 · 2026-10-20

All runs of one call share one prebuild object, so run.prebuild?.ok === false means 'after a failed prebuild'. The run keeps only { ok, duration_ms }: T-018.6's '(exit 2, 3.1s)' must come from PrebuildResult. Under continue a failed prebuilt event is followed by target and run events (T-018.4). S-018.3.7 has 1 s of margin (2 s sleep, 3 s limit) and may flake under load.

### T-018.5 · 2026-10-20

The gate takes each task's last run from model.runs, sorted by at then ID, so a rerun replaces the old run only when its at is later (S-018.5.2).

### T-018.4 · 2026-10-20

Docs (T-018.8): docs/cli.md's --summary text says a passing prebuild's line is left out, which is no longer true. work.ts needed no change: it already exits 1 after a failed prebuild under continue. test/cli/verify.test.ts doesn't assert stderr, since the disk warning depends on the machine.

### T-018.6 · 2026-10-20

verifyOutcome reads the prebuild's ok, duration and exit code from batch.prebuild (PrebuildResult), not run.prebuild; the no-run branch is now 'failed prebuild and no run', so a run under continue always reports the run itself.

### T-018.8 · 2026-10-20

A rerun with --no-prebuild records prebuild null, which also satisfies the done gate (an explicit choice to skip the build). concepts.md's 'Parallel tasks and shared files' now states the early-finish rule too.
