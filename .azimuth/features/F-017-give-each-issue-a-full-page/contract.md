---
language: typescript
---
# F-017: Contract

## Data structures

```ts
// viewer/src/screens/issues/history.ts
import type { Actor, Commit, Id, ISODate, ISODateTime, Issue, Markdown, Sha } from "../../../../src/core/types";

export type HistoryEntry =
  /** From `created` and `found_by`. */
  | { kind: "created"; at: ISODate; by: Id | "you" | "agent" }
  /** A Status notes bullet `<stamp> · <actor> · <from> → <to>: <reason>` (addStatusNote's format). */
  | { kind: "status"; at: ISODateTime; actor: Actor; from: string; to: string; reason: string }
  /** An index commit whose `refs` include the issue's ID. */
  | { kind: "commit"; at: ISODateTime; sha: Sha; subject: string }
  /** A Status notes bullet in any other shape, kept as written. */
  | { kind: "note"; at: null; text: string };

// viewer/src/screens/issues/related.ts
import type { StatusLook } from "../../lib/status";

export interface RelatedItem {
  id: Id;
  /** task: changes an issue file; feature: plans to; link: in `links`; shared-file: a risk listing the same file. */
  kind: "task" | "feature" | "link" | "shared-file";
  /** The item's title, or "Not in the index". */
  title: string;
  /** "Changes src/worker/deliver.ts · covers S-005.3.1, S-005.3.2", "Plans to change …", "Linked from RISK-0001", "Shares src/store/db.ts". */
  reason: string;
  look: StatusLook | null;
  /** Issues link to their page (issuePageHref); everything else to routeForId(id). */
  href: string;
}

/** The muted line under "Related work". */
export const RELATED_RULE =
  "Open tasks of active features that change this issue's files, and the decisions, risks and issues it links to or shares a file with. Matched by file and ID, not decided by anyone.";

// viewer/src/screens/issues/model.ts
import type { ImpactChange } from "../../../../src/core/types";

export interface PlannedChange {
  feature: Id;
  /** The feature's impact change for the path; null when the index has no detail for it (a file conflict only). */
  change: ImpactChange | null;
}
```

## Public signatures

```ts
// viewer/src/App.tsx
/** The screen for a route; `issues` with tab "page" renders IssuePageScreen. Exported for tests. */
export function Screen({ route }: { route: Route }): ReactElement;

// viewer/src/screens/issues/IssuePage.tsx
/** `#/issues/<id>/page`. An unknown ID renders EmptyState "<id> isn't in this index" with "Back to all issues" (`#/issues`). */
export function IssuePageScreen({ id }: { id: string }): ReactElement;

// viewer/src/screens/issues/IssueAside.tsx
/** `<aside aria-label="Issue details">`: facts, Linked features, Files, Source. */
export function IssueAside({ index, issue }: { index: Index; issue: Issue }): ReactElement;

// viewer/src/screens/issues/RelatedWork.tsx
/** `<section aria-label="Related work">`: RELATED_RULE, then a row per item or "Nothing related yet.". */
export function RelatedWork({ index, issue }: { index: Index; issue: Issue }): ReactElement;

// viewer/src/screens/issues/IssueHistory.tsx
/** `<section aria-label="History">`; ends with "No commit references <id> yet" when no commit entry exists. */
export function IssueHistory({ index, issue }: { index: Index; issue: Issue }): ReactElement;

// viewer/src/screens/issues/related.ts
/** Tasks, then feature plans, then links, then risks sharing a file; no duplicates, first reason wins. */
export function relatedWork(index: Index, issue: Issue): RelatedItem[];

// viewer/src/screens/issues/history.ts
/** The body without its "## Status notes" section (matched like sectionOf); the rest unchanged. */
export function bodyWithoutStatusNotes(body: Markdown): Markdown;
/**
 * Created, Status notes bullets and commits naming the issue, sorted by time (`created` as the
 * start of its day; ties keep created, notes in body order, then commits oldest first); bullets
 * that don't parse come last, in body order. A bullet's indented continuation lines join its
 * reason with a space.
 */
export function issueHistory(issue: Issue, commits: Commit[]): HistoryEntry[];

// viewer/src/screens/issues/model.ts
/** "#/issues/BUG-0001/page". */
export function issuePageHref(id: Id): string;
/** Where j, k and Esc lead from an issue's page: neighbours in sortIssues(issues) order (null past either end), and the list. */
export function issuePageTargets(
  issues: Issue[],
  id: Id,
): { previous: string | null; next: string | null; back: string };
/** "open 4 days", "open 1 day", "opened today" (calendar days since `created`, local time); "closed Sep 15" when resolved or won't fix. */
export function issueAge(issue: Issue, now: number): string;
/** featuresChanging(index, path), each with its impact change for the path. */
export function plannedChanges(index: Index, path: string): PlannedChange[];
/** "Planned changes: F-005 (modify) and F-007" ("A, B and C" for three); null for none. */
export function plannedChangesLabel(changes: PlannedChange[]): string | null;

// viewer/src/screens/issues/IssueDetail.tsx (now exported; behavior unchanged)
export function TriageControls({ issue }: { issue: Issue }): ReactElement;

// viewer/src/components/IdChip.tsx
export function IdChip(props: {
  id: string;
  className?: string;
  large?: boolean;
  /** Link target; defaults to routeForId(id). */
  to?: string;
}): ReactElement;

// viewer/src/lib/keys.ts
export function useListKeys(opts: {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
  onOpen?: (index: number) => void;
  onPrimary?: (index: number) => void;
  /** Esc: leave the view (an issue's page goes back to the list). Paused like the other keys. */
  onBack?: () => void;
  enabled?: boolean;
  insideOverlay?: boolean;
}): void;

// viewer/src/components/ProblemsPanel.tsx (parameter widened from Problem)
export function editorLink(
  template: string | null,
  root: string | null,
  p: Pick<Problem, "file" | "line">,
): string | null;

// viewer/src/lib/format.ts
/** "Oct 14, 2026" (dates as written, timestamps in local time); "" for null. */
export function longDate(iso: string | null | undefined): string;
```

## Errors

None new. An unknown issue ID renders an empty state, not an error. Triage failures surface as
they do in the list: `useAction` toasts the server's message, and a refused move leaves the
selects at the issue's current values.

## State transitions
None.
