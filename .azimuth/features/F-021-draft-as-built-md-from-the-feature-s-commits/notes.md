# F-021: Notes

### T-021.1 · 2026-10-20

contract.md's filesChanged comment said first-A-wins; S-021.1.2 (created then deleted is a delete) wins, and the contract was corrected (reapprove after this commit). T-021.3: noUncheckedIndexedAccess is on, so parse --name-status lines by splitting on the tab and checking the parts; paths sort in code-unit order, not localeCompare; deviationsFor keeps a non-blank reason as written and returns hand-written deviations as the same objects, so asBuiltText must write { path, kind, reason } in that order itself; deviationsFor relies on filesChanged having dropped .azimuth/ paths; the rerun case (reason carried from previous) is S-021.4's to test.
