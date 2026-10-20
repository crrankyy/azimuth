# F-019: Notes

### T-019.1 · 2026-10-20

unlistedFiles takes its candidates from selectPaths(...).not_staged (sorted, unique). listedIn (runScope + inScope) decides whether a task lists a path: reuse it for 'another in-progress task lists it' and 'already the task's'. For texts(), read HEAD copies with one readBlobs call over the changed test paths and read results with ?? null (readBlobs can omit a spec); an ENOENT working read is null. The FinishResult fields, the adopt step and FinishOptions.adopt are left to T-019.2 and T-019.3.

### T-019.2 · 2026-10-20

T-019.3 (adopt): validate --adopt between the changed read and the 'Already staged' check, using the check's changed array; pass a task whose files include the adopted paths to the 'Already staged' selectPaths, unlistedFiles and the stage step's selectPaths (return the widened task from check). Reuse listedIn and others for 'already the task's' and 'another in-progress task lists it'. T-019.4: test/cli/task.test.ts has its own repo() helper and needs shared_files in its config; no test has exercised the shared field yet.
