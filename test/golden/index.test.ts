import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildIndex } from "../../src/core/build-index";
import { compareIds } from "../../src/core/ids";
import type { Index } from "../../src/core/types";
import { sortProblems } from "../../src/core/validate";
import { expectedIndex } from "../fixtures/hookline/expected-index";
import { createDemoRepo, type DemoRepo } from "../helpers/demo-repo";

/**
 * The Hookline fixture reproduces the viewer brief's sample data as real files and a real git
 * history. The index built from it must equal the sample, except for the deviations listed
 * here, each of which the sample cannot know or Azimuth deliberately computes differently.
 */

const NOW = new Date("2026-10-18T12:05:00Z");

let repo: DemoRepo;
let actual: Index;

/** Rewrites every replayed SHA to the sample's SHA for the commit with the same subject. */
function mapShas(index: Index, shas: Map<string, string>): Index {
  const bySubject = new Map(expectedIndex.commits.map((c) => [c.subject, c.sha]));
  const replace = new Map<string, string>();
  for (const [subject, sha] of shas) {
    const expected = bySubject.get(subject);
    if (expected) replace.set(sha, expected);
  }
  const pattern = new RegExp([...replace.keys()].join("|"), "g");
  return JSON.parse(
    JSON.stringify(index).replace(pattern, (sha) => replace.get(sha) ?? sha),
  ) as Index;
}

function expectedWithDeviations(): Index {
  const e = structuredClone(expectedIndex) as unknown as Index;
  // The replayed repo leaves session files and architecture.md uncommitted: they name SHAs of
  // commits made after them, so the tree is necessarily dirty.
  e.project.git.dirty = true;
  // The root commit adds the whole pre-history of the fixture, not one file.
  const root = e.commits.at(-1);
  if (root) root.files_changed = actual.commits.at(-1)?.files_changed ?? root.files_changed;
  // "2 lint errors" would need parsing tool output, which v0.1 doesn't do.
  const f007 = e.features.find((f) => f.id === "F-007");
  const verifyCheck = f007?.derived.next_gate?.checks.find((c) => c.id === "done.verify-passed");
  if (verifyCheck) verifyCheck.detail = "T-007.4 failed at b13f5c0";
  for (const item of e.inbox) {
    if (item.kind === "failing-verify") {
      item.detail = "`pnpm vitest run && pnpm eslint .` exited 1 (run R-0138).";
    }
    // No file records when ADR-0004 was proposed; the proposing session's start is used.
    if (item.kind === "review-adr") item.since = "2026-10-18T11:00:00Z";
    // Validation errors have no timestamp of their own: they are as old as the index.
    if (item.kind === "check-errors") {
      item.detail =
        'likelihood must be low, medium or high (got "med"). RISK-0002 was left out of the index.';
      item.since = "2026-10-18T12:05:00Z";
    }
  }
  // W-ARCH-STALE counts only code commits (BUG-0028). Four of the 11 commits after the
  // reconciliation only change .azimuth/ (specs), and 7 code commits are within the limit of 10.
  e.problems = e.problems.filter((p) => p.code !== "W-ARCH-STALE");
  // The sample predates the W-NO-COVERS hint (F-023), which the drafts' tasks covering nothing get.
  const noCovers = (feature: string, task: string) => ({
    code: "W-NO-COVERS",
    severity: "warning" as const,
    file: `.azimuth/features/${feature}/plan.md`,
    line: null,
    ref: task,
    message: `${task} covers no scenario: list the scenarios it makes pass, unless it only scaffolds, wires or documents.`,
  });
  e.problems = sortProblems([
    ...e.problems,
    noCovers("F-008-delivery-replay", "T-008.1"),
    noCovers("F-008-delivery-replay", "T-008.5"),
    noCovers("F-008-delivery-replay", "T-008.6"),
    noCovers("F-009-endpoint-rate-limits", "T-009.4"),
    noCovers("F-009-endpoint-rate-limits", "T-009.5"),
  ]);
  return e;
}

/** The live index carries detail for every feature and every recorded run; the sample has less. */
function comparable(index: Index): Index {
  const runIds = new Set(expectedIndex.runs.map((r) => r.id));
  return {
    ...index,
    rev: "",
    project: { ...index.project, root: null },
    features: index.features.map((f) => (f.id === "F-005" ? f : { ...f, detail: undefined })),
    runs: index.runs.filter((r) => runIds.has(r.id)).sort((a, b) => compareIds(b.id, a.id)),
  };
}

beforeAll(() => {
  repo = createDemoRepo();
  actual = mapShas(buildIndex(repo.root, { now: NOW, mode: "live" }).index, repo.shas);
});

afterAll(() => repo?.cleanup());

describe("index built from the Hookline fixture", () => {
  const sections = [
    "project",
    "knowledge",
    "milestones",
    "features",
    "decisions",
    "questions",
    "issues",
    "sessions",
    "commits",
    "runs",
    "live",
    "inbox",
    "problems",
  ] as const;

  for (const section of sections) {
    it(`matches the sample's ${section}`, () => {
      const got = JSON.parse(JSON.stringify(comparable(actual)[section]));
      expect(got).toEqual(expectedWithDeviations()[section]);
    });
  }

  it("keeps the extra runs that make F-001 to F-003 pass", () => {
    expect(actual.runs.length).toBeGreaterThan(expectedIndex.runs.length);
    expect(actual.runs.every((r) => r.at <= NOW.toISOString())).toBe(true);
  });

  it("includes detail for every feature in the live index", () => {
    expect(actual.features.every((f) => f.detail !== undefined)).toBe(true);
  });
});
