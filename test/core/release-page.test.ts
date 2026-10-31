import { describe, expect, it } from "vitest";
import {
  formatMilestonePage,
  milestonePage,
  type MilestonePage,
} from "../../src/core/milestone-page";
import type { Commit, Index, Milestone } from "../../src/core/types";
import { expectedIndex } from "../fixtures/hookline/expected-index";

const fixtureIndex = (): Index => structuredClone(expectedIndex) as unknown as Index;

const milestone = (index: Index, id: string): Milestone => {
  const m = index.milestones.find((x) => x.id === id);
  if (!m) throw new Error(`${id} is missing from the fixture index`);
  return m;
};

const pageOf = (index: Index, id: string): MilestonePage => {
  const page = milestonePage(index, id);
  if (!page) throw new Error(`${id} has no page`);
  return page;
};

const sections = (text: string): string[] => text.split("\n\n");

const releaseLine = /^(Tag:|Released commit:|Commits naming)/;

const releaseCommit: Commit = {
  sha: "c0ffee1",
  at: "2026-09-28T10:00:00Z",
  actor: "you",
  session: null,
  subject: "chore(azimuth): release M-01",
  refs: ["M-01"],
  files_changed: 1,
};

describe("the milestone page's release and commits", () => {
  it("S-028.7.1 ends the page with the tag, the released commit and the commits naming it", () => {
    const index = fixtureIndex();
    const m = milestone(index, "M-01");
    m.tag = "v1.0.0";
    m.released_commit = "c0ffee1";
    index.commits = [releaseCommit, ...index.commits];
    const text = formatMilestonePage(pageOf(index, "M-01"));
    expect(sections(text).slice(-2)).toEqual([
      "Tag: v1.0.0\nReleased commit: c0ffee1",
      "Commits naming M-01:\n  c0ffee1 2026-09-28 chore(azimuth): release M-01",
    ]);
    expect(pageOf(index, "M-01").commits).toEqual([releaseCommit]);
  });

  it("S-028.7.2 leaves both sections out for an unreleased milestone without commits", () => {
    const index = fixtureIndex();
    const text = formatMilestonePage(pageOf(index, "M-02"));
    expect(text.split("\n").filter((line) => releaseLine.test(line))).toEqual([]);
    expect(pageOf(index, "M-02").commits).toEqual([]);
  });

  it("S-028.7.3 keeps F-026's page for a release without tag, commit or commits", () => {
    const index = fixtureIndex();
    const text = formatMilestonePage(pageOf(index, "M-01"));
    expect(sections(text).at(-1)?.startsWith("done (3)")).toBe(true);
    expect(text.split("\n").filter((line) => releaseLine.test(line))).toEqual([]);

    milestone(index, "M-01").tag = "v1.0.0";
    expect(sections(formatMilestonePage(pageOf(index, "M-01"))).at(-1)).toBe("Tag: v1.0.0");
  });

  it("S-028.7.4 lists the first ten commits and counts the rest", () => {
    const index = fixtureIndex();
    const steps: Commit[] = Array.from({ length: 12 }, (_, n) => ({
      sha: `a${String(n + 1).padStart(6, "0")}`,
      at: "2026-10-17T10:00:00Z",
      actor: "agent",
      session: null,
      subject: "chore: step",
      refs: ["M-02"],
      files_changed: 1,
    }));
    index.commits = [...steps, ...index.commits];
    const last = sections(formatMilestonePage(pageOf(index, "M-02"))).at(-1) ?? "";
    expect(last.split("\n")).toEqual([
      "Commits naming M-02:",
      ...Array.from(
        { length: 10 },
        (_, n) => `  a${String(n + 1).padStart(6, "0")} 2026-10-17 chore: step`,
      ),
      "  … and 2 more",
    ]);
  });
});
