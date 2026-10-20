import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Commit, Index, Issue } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { issueHistory } from "./history";
import { IssueHistory } from "./IssueHistory";

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

const bug1 = (index: Index): Issue => index.issues.find((i) => i.id === "BUG-0001")!;

const MOVED = "2026-10-15T12:00:00Z · agent · open → in-progress: Reproduced with two workers";

const KEEP_LEASE: Commit = {
  sha: "abc1234",
  at: "2026-10-16T12:00:00Z",
  actor: "agent",
  session: null,
  subject: "fix(F-005): keep the lease while recording the outcome",
  refs: ["F-005", "BUG-0001"],
  files_changed: 1,
};

/** BUG-0001 with one Status notes bullet and a commit naming it, as in S-017.6.1. */
function movedAndCommitted(): Index {
  const index = fixture();
  const issue = bug1(index);
  issue.body = `${issue.body}\n\n## Status notes\n- ${MOVED}\n`;
  index.commits = [KEEP_LEASE, ...index.commits];
  return index;
}

/** The text of each History row: its columns (spans) apart, inline tags dropped. */
function rows(html: string): string[] {
  return html
    .split("<li")
    .slice(1)
    .map((row) =>
      row
        .replace(/^[^>]*>/, "")
        .replace(/<\/span>/g, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    );
}

const renderHistory = (index: Index) =>
  renderToStaticMarkup(<IssueHistory index={index} issue={bug1(index)} />);

describe("F-017 issue history", () => {
  it("S-017.6.1 lists filed, moved and committed, oldest first", () => {
    const index = movedAndCommitted();
    expect(issueHistory(bug1(index), index.commits)).toEqual([
      { kind: "created", at: "2026-10-14", by: "you" },
      {
        kind: "status",
        at: "2026-10-15T12:00:00Z",
        actor: "agent",
        from: "open",
        to: "in-progress",
        reason: "Reproduced with two workers",
      },
      {
        kind: "commit",
        at: "2026-10-16T12:00:00Z",
        sha: "abc1234",
        subject: "fix(F-005): keep the lease while recording the outcome",
      },
    ]);
  });

  it("S-017.6.2 reads the History section as a timeline", () => {
    const html = renderHistory(movedAndCommitted());
    expect(html).toContain('aria-label="History"');
    expect(rows(html)).toEqual([
      "Oct 14 You filed it",
      "Oct 15 An agent moved it from Open to In progress: Reproduced with two workers",
      "Oct 16 abc1234 fix(F-005): keep the lease while recording the outcome",
    ]);
  });

  it("S-017.6.3 says so when no commit names the issue", () => {
    expect(rows(renderHistory(fixture()))).toEqual([
      "Oct 14 You filed it",
      "— No commit references BUG-0001 yet",
    ]);
  });

  it("S-017.6.4 keeps a hand-written status note as written, after the dated entries", () => {
    const index = fixture();
    const issue = bug1(index);
    issue.body = `${issue.body}\n\n## Status notes\n- Checked again after the F-005 merge\n- 2026-10-15T12:00:00Z · you · open → resolved: Fixed by F-005\n`;
    expect(issueHistory(issue, index.commits)).toEqual([
      { kind: "created", at: "2026-10-14", by: "you" },
      {
        kind: "status",
        at: "2026-10-15T12:00:00Z",
        actor: "you",
        from: "open",
        to: "resolved",
        reason: "Fixed by F-005",
      },
      { kind: "note", at: null, text: "Checked again after the F-005 merge" },
    ]);
  });
});

describe("F-024 a logged note in the issue history", () => {
  it("S-024.1.7 dates a logged note and sorts it between the move and the commit", () => {
    const index = movedAndCommitted();
    const issue = bug1(index);
    issue.body = `${issue.body}- 2026-10-15T13:00:00Z · agent · Fails only with two workers\n`;
    expect(rows(renderHistory(index))).toEqual([
      "Oct 14 You filed it",
      "Oct 15 An agent moved it from Open to In progress: Reproduced with two workers",
      "Oct 15 An agent noted: Fails only with two workers",
      "Oct 16 abc1234 fix(F-005): keep the lease while recording the outcome",
    ]);
    expect(issueHistory(issue, index.commits)[2]).toEqual({
      kind: "logged",
      at: "2026-10-15T13:00:00Z",
      actor: "agent",
      text: "Fails only with two workers",
    });
  });

  it("S-024.1.8 keeps a bullet whose first part isn't a time as written", () => {
    const index = fixture();
    const issue = bug1(index);
    issue.body = `${issue.body}\n\n## Status notes\n- someday · you · Look again\n`;
    expect(issueHistory(issue, index.commits)).toEqual([
      { kind: "created", at: "2026-10-14", by: "you" },
      { kind: "note", at: null, text: "someday · you · Look again" },
    ]);
  });
});
