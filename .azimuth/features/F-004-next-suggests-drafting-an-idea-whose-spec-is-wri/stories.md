# F-004: Stories

## ST-004.1 · The next step for an idea
**Intent:** As an agent, I want `next` to point at the draft move once I've written an idea's spec so that I don't redo the spec or wonder what's left.

### S-004.1.1 · Spec files written {happy}
- **GIVEN** an idea whose draft gate passes (all four spec files exist)
- **WHEN** its next step is computed
- **THEN** the action is `azimuth move F-010 draft` with the reason `Spec written; ready for draft`

### S-004.1.2 · No spec yet {negative}
- **GIVEN** an idea whose draft gate fails (no spec files)
- **WHEN** its next step is computed
- **THEN** the action is `/azimuth:spec F-010` with the reason `Idea without a spec`
