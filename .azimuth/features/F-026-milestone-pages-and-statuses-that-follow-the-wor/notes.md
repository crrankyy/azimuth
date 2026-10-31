# F-026: Notes

### T-026.2 · 2026-10-31

Activation reads the milestone record from model.milestones, not the feature's raw field, so an ID without a file is a no-op; every refusal runs before it, so a refused move writes nothing. The viewer's move action needed no server change.
