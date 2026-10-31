import { describe, expect, it } from "vitest";
import type { Index, Milestone } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { releaseLead, releaseOffer, releaseRequest } from "./release";

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

/** The fixture's milestone with this ID, with the given fields replaced. */
function milestone(id: string, changes: Partial<Milestone> = {}): Milestone {
  const found = fixture().milestones.find((m) => m.id === id);
  if (!found) throw new Error(`No fixture milestone ${id}`);
  return { ...found, ...changes };
}

describe("F-028 the Roadmap's Release control", () => {
  it("S-028.6.1 offers an enabled Release on a finished planned milestone", () => {
    const m = milestone("M-03", { progress: { done: 2, total: 2, by_status: { done: 2 } } });
    expect(releaseOffer(m)).toEqual({ enabled: true, why: null });
  });

  it("S-028.6.2 offers nothing on an unfinished or empty planned milestone", () => {
    const unfinished = milestone("M-03", {
      progress: { done: 1, total: 2, by_status: { done: 1, draft: 1 } },
    });
    const empty = milestone("M-03", { progress: { done: 0, total: 0, by_status: {} } });
    expect(releaseOffer(unfinished)).toBeNull();
    expect(releaseOffer(empty)).toBeNull();
  });

  it("S-028.6.3 keeps the active milestone's control and offers nothing once released", () => {
    const unfinished = milestone("M-02", {
      progress: { done: 1, total: 3, by_status: { done: 1, draft: 2 } },
    });
    const empty = milestone("M-02", { progress: { done: 0, total: 0, by_status: {} } });
    const released = milestone("M-01", { progress: { done: 2, total: 2, by_status: { done: 2 } } });
    expect(releaseOffer(unfinished)).toEqual({ enabled: false, why: "2 features not done" });
    expect(releaseOffer(empty)).toEqual({ enabled: true, why: null });
    expect(releaseOffer(released)).toBeNull();
  });

  it("S-028.6.5 sends the release action with the status the page shows", () => {
    expect(releaseRequest(milestone("M-03"))).toEqual({
      action: "release",
      ref: "M-03",
      payload: {},
      expect: "planned",
    });
  });

  it("S-028.6.6 tells the dialog a planned milestone passes through active", () => {
    expect(releaseLead(milestone("M-03"))).toBe(
      "M-03 is still planned: releasing it makes it active and released in one step.",
    );
    expect(releaseLead(milestone("M-02"))).toBeNull();
  });
});
