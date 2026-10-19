import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Index, Issue } from "../../../../src/core/types";
import { expectedIndex } from "../../../../test/fixtures/hookline/expected-index";
import { RELATED_RULE, relatedWork, type RelatedItem } from "./related";
import { RelatedWork } from "./RelatedWork";

const fixture = () => structuredClone(expectedIndex) as unknown as Index;

const issue = (index: Index, id: string): Issue => index.issues.find((i) => i.id === id)!;

/** What a related row shows: its ID, kind, reason, status label and link. */
const rows = (items: RelatedItem[]) =>
  items.map((r) => ({
    id: r.id,
    kind: r.kind,
    reason: r.reason,
    status: r.look?.label ?? null,
    href: r.href,
  }));

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe("F-017 related work", () => {
  it("S-017.4.1 lists open tasks, then feature plans, that change the issue's files", () => {
    const index = fixture();
    expect(rows(relatedWork(index, issue(index, "BUG-0001")))).toEqual([
      {
        id: "T-005.5",
        kind: "task",
        reason: "Changes src/worker/deliver.ts · covers S-005.3.1, S-005.3.2",
        status: "Blocked",
        href: "#/features/F-005/plan/T-005.5",
      },
      {
        id: "T-005.6",
        kind: "task",
        reason: "Changes src/worker/deliver.ts",
        status: "Todo",
        href: "#/features/F-005/plan/T-005.6",
      },
      {
        id: "F-007",
        kind: "feature",
        reason: "Plans to change src/worker/deliver.ts",
        status: "Verifying",
        href: "#/features/F-007",
      },
    ]);
  });

  it("S-017.4.2 lists linked decisions, then risks that share a file", () => {
    const index = fixture();
    index.issues.push({
      ...issue(index, "RISK-0001"),
      id: "RISK-0003",
      title: "Backups lock the database",
      links: [],
      file: ".azimuth/issues/RISK-0003-backup-lock.md",
    });
    expect(rows(relatedWork(index, issue(index, "RISK-0001")))).toEqual([
      {
        id: "ADR-0001",
        kind: "link",
        reason: "Linked from RISK-0001",
        status: "Accepted",
        href: "#/decisions/ADR-0001",
      },
      {
        id: "RISK-0003",
        kind: "shared-file",
        reason: "Shares src/store/db.ts",
        status: "Open",
        href: "#/issues/RISK-0003/page",
      },
    ]);
  });

  it("S-017.4.3 drops done tasks and lets their feature's plan stand in", () => {
    const index = fixture();
    const f005 = index.features.find((f) => f.id === "F-005")!;
    for (const t of f005.detail!.tasks)
      if (t.id === "T-005.5" || t.id === "T-005.6") t.status = "done";
    expect(rows(relatedWork(index, issue(index, "BUG-0001")))).toEqual([
      {
        id: "F-005",
        kind: "feature",
        reason: "Plans to change src/worker/deliver.ts",
        status: "In progress",
        href: "#/features/F-005",
      },
      {
        id: "F-007",
        kind: "feature",
        reason: "Plans to change src/worker/deliver.ts",
        status: "Verifying",
        href: "#/features/F-007",
      },
    ]);
  });

  it("S-017.4.4 says nothing is related", () => {
    const index = fixture();
    const bug2 = issue(index, "BUG-0002");
    expect(relatedWork(index, bug2)).toEqual([]);
    const html = renderToStaticMarkup(<RelatedWork index={index} issue={bug2} />);
    expect(html).toContain('aria-label="Related work"');
    expect(text(html)).toBe(`Related work ${RELATED_RULE} Nothing related yet.`);
  });
});
