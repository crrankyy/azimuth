import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { userEventsSince } from "../../src/core/delta";
import { AzimuthError } from "../../src/core/errors";
import { loadProject } from "../../src/core/model";
import { acknowledge } from "../../src/core/transitions";
import { featureFiles } from "../helpers/project";
import { MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const FEATURE_MD = ".azimuth/features/F-001-thing/feature.md";
const NOW = new Date("2026-10-20T12:00:00Z");

const TRANSITIONS = [
  "## 2026-10-19T09:00:00Z · agent · transition\nidea → draft\n",
  "## 2026-10-19T10:00:00Z · agent · transition\ndraft → approved\n",
  "## 2026-10-19T11:00:00Z · agent · transition\napproved → in-progress\n",
];

const note = (at: string, actor: string, body: string) => `## ${at} · ${actor} · note\n${body}\n`;

const SETTLED_TWO = [
  note("2026-10-20T10:00:00Z", "agent", "Settled S-001.1.1: {=17}"),
  note("2026-10-20T10:05:00Z", "agent", "Settled S-001.2.1: {=3..5}"),
];

/** F-001 in progress, approved by `approvedBy`, with these log entries after its transitions. */
function project(approvedBy: string, reviewAck: string, entries: string[], extra = {}) {
  const tree = writeTree({
    ".azimuth/config.yaml": MINIMAL_CONFIG,
    ...featureFiles({
      id: "F-001",
      status: "in-progress",
      stories: { "ST-001.1": ["happy", "negative"], "ST-001.2": ["happy", "edge"] },
      extra: { approved_by: approvedBy, approved_at: "2026-10-19", review_ack_at: reviewAck },
      log: [...TRANSITIONS, ...entries].join("\n"),
    }),
    ...extra,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

const reviewItems = (root: string) =>
  buildIndex(root, { now: NOW }).index.inbox.filter(
    (i) => i.kind === "review-auto" && i.ref === "F-001",
  );

function errorOf(fn: () => unknown): AzimuthError {
  try {
    fn();
  } catch (e) {
    if (e instanceof AzimuthError) return e;
    throw e;
  }
  throw new Error("expected an AzimuthError");
}

describe("ST-008.10 you review the values an agent settled", () => {
  it("S-008.10.1 gives values settled after the acknowledgement a Review item", () => {
    const root = project("agent", "2026-10-19T20:00:00Z", SETTLED_TWO);
    expect(reviewItems(root)).toEqual([
      {
        kind: "review-auto",
        ref: "F-001",
        title: "Feature F-001: 2 values settled by an agent",
        detail:
          "Settled S-001.1.1: 17; S-001.2.1: 3..5. Acknowledge them or send the spec back to draft.",
        since: "2026-10-20T10:00:00Z",
        urgency: "low",
      },
    ]);
  });

  it("S-008.10.2 doesn't count earlier settles, yours or other notes", () => {
    const root = project("agent", "2026-10-19T20:00:00Z", [
      note("2026-10-19T19:00:00Z", "agent", "Settled S-001.1.1: {=17}"),
      note("2026-10-20T11:00:00Z", "you", "Settled S-001.1.1: {=17}"),
      note("2026-10-20T11:30:00Z", "agent", "Settled the open questions"),
    ]);
    expect(reviewItems(root)).toEqual([]);
  });

  it("S-008.10.3 lists the values in an unacknowledged automatic approval", () => {
    const root = project("agent", "null", [
      note("2026-10-20T10:00:00Z", "agent", "Settled S-001.1.1: {=17}"),
    ]);
    const items = reviewItems(root);
    expect(items.map((i) => [i.title, i.detail])).toEqual([
      [
        "Feature F-001 was approved automatically",
        "An agent approved this spec when every check passed. Acknowledge it or send it back to draft. Settled by an agent: S-001.1.1: 17.",
      ],
    ]);
  });

  it("S-008.10.4 clears them when you acknowledge the feature", () => {
    const root = project("agent", "2026-10-19T20:00:00Z", SETTLED_TWO);
    acknowledge(root, "F-001", { actor: "you", now: NOW });
    expect(loadProject(root).features[0]?.review_ack_at).toBe("2026-10-20T12:00:00Z");
    expect(reviewItems(root)).toEqual([]);
  });

  it("S-008.10.5 gives a feature you approved an item too", () => {
    const root = project("you", "null", [
      note("2026-10-20T10:00:00Z", "agent", "Settled S-001.1.1: {=17}"),
    ]);
    expect(reviewItems(root)).toEqual([
      {
        kind: "review-auto",
        ref: "F-001",
        title: "Feature F-001: 1 value settled by an agent",
        detail: "Settled S-001.1.1: 17. Acknowledge it or send the spec back to draft.",
        since: "2026-10-20T10:00:00Z",
        urgency: "low",
      },
    ]);
  });

  it("S-008.10.6 clears the item of a feature you approved when you acknowledge it", () => {
    const root = project("you", "null", [
      note("2026-10-20T10:00:00Z", "agent", "Settled S-001.1.1: {=17}"),
    ]);
    const result = acknowledge(root, "F-001", { actor: "you", now: NOW });
    expect(result.message).toBe("F-001: acknowledged");
    expect(loadProject(root).features[0]?.review_ack_at).toBe("2026-10-20T12:00:00Z");
    expect(reviewItems(root)).toEqual([]);
  });

  it("S-008.10.7 refuses a feature you approved with nothing to review", () => {
    const root = project("you", "2026-10-20T12:00:00Z", [
      note("2026-10-20T10:00:00Z", "agent", "Settled S-001.1.1: {=17}"),
    ]);
    const before = readFileSync(join(root, FEATURE_MD), "utf8");
    const error = errorOf(() => acknowledge(root, "F-001", { actor: "you" }));
    expect([error.code, error.message]).toEqual([
      "invalid",
      "F-001 has no automatic decision to acknowledge.",
    ]);
    expect(readFileSync(join(root, FEATURE_MD), "utf8")).toBe(before);
  });

  it("S-008.10.8 tells the agent what you acknowledged", () => {
    const root = project(
      "you",
      "2026-10-20T12:00:00Z",
      [],
      featureFiles({
        id: "F-002",
        status: "in-progress",
        extra: {
          approved_by: "agent",
          approved_at: "2026-10-19",
          review_ack_at: "2026-10-20T12:05:00Z",
        },
      }),
    );
    const events = userEventsSince(loadProject(root), { at: "2026-10-20T00:00:00Z", keys: [] });
    expect(events.map((e) => e.text)).toEqual([
      "acknowledged the values settled in F-001",
      "acknowledged the automatic approval of F-002",
    ]);
  });
});
