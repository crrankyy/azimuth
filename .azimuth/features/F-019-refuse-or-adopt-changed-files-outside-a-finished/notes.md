# F-019: Notes

### T-019.1 · 2026-10-20

unlistedFiles takes its candidates from selectPaths(...).not_staged (sorted, unique). listedIn (runScope + inScope) decides whether a task lists a path: reuse it for 'another in-progress task lists it' and 'already the task's'. For texts(), read HEAD copies with one readBlobs call over the changed test paths and read results with ?? null (readBlobs can omit a spec); an ENOENT working read is null. The FinishResult fields, the adopt step and FinishOptions.adopt are left to T-019.2 and T-019.3.
