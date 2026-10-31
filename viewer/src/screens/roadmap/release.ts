import { milestoneReady } from "../../../../src/core/flows";
import type { Id, Milestone, MilestoneStatus } from "../../../../src/core/types";
import { plural } from "../../lib/format";

/** What the Release… control shows: enabled, or disabled with the reason. */
export interface ReleaseOffer {
  enabled: boolean;
  /** `<n> feature(s) not done`, shown next to a disabled control; null when enabled. */
  why: string | null;
}

/** The arguments of the viewer's `run(action, ref, payload, expect)` for a release. */
export interface ReleaseRequest {
  action: "release";
  ref: Id;
  payload: Record<string, never>;
  expect: MilestoneStatus;
}

/**
 * Active: always offered, enabled when every counted feature is done, else disabled with the
 * count. Planned: offered only once ready, since an unfinished planned milestone has nothing to
 * release and the control would be noise. Released: never.
 */
export function releaseOffer(m: Milestone): ReleaseOffer | null {
  if (m.status === "active") {
    const notDone = m.progress.total - m.progress.done;
    return notDone > 0
      ? { enabled: false, why: `${plural(notDone, "feature")} not done` }
      : { enabled: true, why: null };
  }
  if (m.status === "planned" && milestoneReady(m)) return { enabled: true, why: null };
  return null;
}

/** The status shown goes along as `expect`, so a milestone that changed meanwhile is a conflict. */
export function releaseRequest(m: Milestone): ReleaseRequest {
  return { action: "release", ref: m.id, payload: {}, expect: m.status };
}

/** A planned milestone skips the visible active step, so the dialog says so first. */
export function releaseLead(m: Milestone): string | null {
  if (m.status !== "planned") return null;
  return `${m.id} is still planned: releasing it makes it active and released in one step.`;
}
