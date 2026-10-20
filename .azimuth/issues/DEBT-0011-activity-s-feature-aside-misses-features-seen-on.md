---
id: DEBT-0011
type: debt
title: Activity's feature aside misses features seen only on live cards
status: open
severity: low
likelihood: null
impact: null
links: [F-016]
files: [viewer/src/screens/Activity.tsx, viewer/src/components/SessionCard.tsx]
found_by: SES-20261019-2021
created: 2026-10-20
resolved_at: null
---
## Problem
The feature aside on Activity counts feed items only, so a feature named only by a live card or a
timeline row gets no option there; and the collapsed SessionCard keeps a spacer element that no
longer does anything since F-016's polish let the goal fill the gap.

## Proposed fix
Count live cards (and timeline sessions) in the aside's feature counts, and drop the spacer.
