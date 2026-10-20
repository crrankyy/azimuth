# F-018: Notes

### T-018.1 · 2026-10-20

T-018.3: verifyBatch still stops on any failed prebuild and passes neither prebuild nor timeout_seconds to runVerify; recording { ok: true } after a passing prebuild is its job too, and the runs comment needs updating. T-018.2: replace the prebuild: null placeholder in parseRun (after the waited_ms/ses spreads); neither key has a config test yet. T-018.7: min_free_gb already parses and defaults to 10; r.int(0) gives exactly 'verify.min_free_gb must be a whole number ≥ 0.'. analysis.test.ts and test/fixtures/live/agents.ts take runs from expectedIndex, so the fixture fix covered them.
