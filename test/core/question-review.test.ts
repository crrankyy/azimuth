import { afterEach, describe, expect, it } from "vitest";
import { statusBrief } from "../../src/core/brief";
import { buildIndex } from "../../src/core/build-index";
import { userEventsSince } from "../../src/core/delta";
import { loadProject } from "../../src/core/model";
import { pendingAnswers } from "../../src/core/next";
import { featureFiles } from "../helpers/project";
import { featureMd, MINIMAL_CONFIG, writeTree } from "../helpers/tree";

let cleanup: (() => void) | null = null;
afterEach(() => cleanup?.());

const PROCEED = `${MINIMAL_CONFIG}autonomy:\n  questions: proceed\n`;
const NOW = new Date("2026-10-20T12:00:00Z");
const AGENT_ANSWER = '{option: a, text: "", answered_at: 2026-10-20T09:00:00Z, by: agent}';
const DECIDED = "Decided by the user in the viewer, not yet applied:";

/** The proceed project: F-001 with a log and Q-0001 "Which lock?" (`over` changes the question). */
function project(over: Record<string, string> = {}) {
  const question = featureMd({
    id: "Q-0001",
    title: "Which lock?",
    status: "open",
    feature: "F-001",
    blocking: "false",
    raised_by: "agent",
    raised_at: "2026-10-20T08:55:00Z",
    options: [
      "",
      "  - key: a",
      "    label: Lockfile",
      "    detail: Simple",
      "    recommended: true",
      "  - key: b",
      "    label: Advisory lock",
      "    detail: Faster",
    ].join("\n"),
    answer: "null",
    resolution: "null",
    ...over,
  });
  const tree = writeTree({
    ".azimuth/config.yaml": PROCEED,
    ...featureFiles({ id: "F-001", status: "in-progress" }),
    ".azimuth/questions/Q-0001.md": question,
  });
  cleanup = tree.cleanup;
  return tree.root;
}

const indexOf = (root: string) => buildIndex(root, { now: NOW }).index;
const cursor = (at: string) => ({ at, keys: [] });

describe("ST-012.1 the status brief names the questions mode", () => {
  it("S-012.1.4 names proceed on the autonomy line", () => {
    const brief = statusBrief(indexOf(project()));
    expect(brief.split("\n")[1]).toBe("Autonomy: specs auto, decisions auto, questions proceed");
  });
});

describe("ST-012.4 agent answers wait for your review", () => {
  it("S-012.4.1 lists an agent's answer in the Review group", () => {
    const index = indexOf(project({ status: "answered", answer: AGENT_ANSWER }));
    expect(index.inbox.filter((i) => i.ref === "Q-0001")).toEqual([
      {
        kind: "review-auto",
        ref: "Q-0001",
        title: "Which lock?",
        detail:
          "Answered by an agent with its recommendation: Lockfile. Acknowledge it or answer differently.",
        since: "2026-10-20T09:00:00Z",
        urgency: "low",
      },
    ]);
  });

  it("S-012.4.2 clears the item once you acknowledge and tells the agent", () => {
    const root = project({
      status: "answered",
      answer: AGENT_ANSWER,
      review_ack_at: "2026-10-20T10:00:00Z",
    });
    expect(indexOf(root).inbox.filter((i) => i.ref === "Q-0001")).toEqual([]);
    const events = userEventsSince(loadProject(root), cursor("2026-10-20T09:30:00Z"));
    expect(events.map((e) => ({ feature: e.feature, text: e.text }))).toEqual([
      { feature: "F-001", text: "acknowledged the automatic answer to Q-0001" },
    ]);
  });

  it("S-012.4.3 reports your answer as your decision", () => {
    const root = project({
      status: "answered",
      answer:
        '{option: b, text: "Use the advisory lock", answered_at: 2026-10-20T10:00:00Z, by: you}',
    });
    const events = userEventsSince(loadProject(root), cursor("2026-10-20T09:30:00Z"));
    expect(events.map((e) => ({ feature: e.feature, text: e.text }))).toEqual([
      {
        feature: "F-001",
        text: "answered Q-0001 (Which lock?): Advisory lock — Use the advisory lock. Apply it, then `azimuth resolve Q-0001`.",
      },
    ]);
    const lines = statusBrief(indexOf(root)).split("\n");
    const at = lines.indexOf(DECIDED);
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe(
      "  Q-0001 (F-001) Which lock?: Advisory lock — Use the advisory lock",
    );
  });

  it("S-012.4.4 keeps an agent's own answer out of your decisions", () => {
    const root = project({ status: "answered", answer: AGENT_ANSWER });
    expect(userEventsSince(loadProject(root), cursor("2026-10-20T08:00:00Z"))).toEqual([]);
    const index = indexOf(root);
    expect(pendingAnswers(index)).toEqual([]);
    expect(statusBrief(index).split("\n")).not.toContain(DECIDED);
  });
});
