import { milestoneReady, milestoneStartedWhilePlanned } from "./flows";
import { byPriority } from "./next";
import type { FeatureStatus, Id, Index, Milestone, Priority } from "./types";

/** One feature line of a milestone page. */
export interface MilestonePageFeature {
  id: Id;
  priority: Priority;
  title: string;
}

/** The features of one status, by priority then ID (byPriority). */
export interface MilestonePageGroup {
  status: FeatureStatus;
  /** False for cancelled and superseded, which milestoneProgress doesn't count. */
  counted: boolean;
  features: MilestonePageFeature[];
}

/**
 * What `azimuth show M-NN` prints. F-028 adds its commits as one more field (and its release
 * and commits sections as two more section functions in formatMilestonePage).
 */
export interface MilestonePage {
  /** The index's milestone, with its features and progress. */
  milestone: Milestone;
  /** Non-empty groups in PAGE_STATUS_ORDER. */
  groups: MilestonePageGroup[];
  /** Counted features that aren't done (deferred included), in the groups' order. */
  blocking: Id[];
  /** milestoneReady(milestone). */
  ready: boolean;
  /** milestoneStartedWhilePlanned(milestone). */
  started_while_planned: boolean;
}

/** The groups' order: work in flight, what waits, what is finished, what doesn't count. */
export const PAGE_STATUS_ORDER: readonly FeatureStatus[] = [
  "in-progress",
  "verifying",
  "approved",
  "draft",
  "idea",
  "deferred",
  "done",
  "cancelled",
  "superseded",
];

// derive.ts's RETIRED_STATUSES, restated: derive.ts pulls in Node modules and this page must not.
const UNCOUNTED: readonly FeatureStatus[] = ["cancelled", "superseded"];

/**
 * The page of the index's milestone `id`, or null when there is none. Groups the index's
 * features whose `milestone` is `id` by status in PAGE_STATUS_ORDER, leaving out empty groups,
 * each sorted with byPriority. Pure: no I/O, no clock.
 */
export function milestonePage(index: Index, id: string): MilestonePage | null {
  const milestone = index.milestones.find((m) => m.id === id);
  if (!milestone) return null;
  const members = index.features.filter((f) => f.milestone === id);
  const groups = PAGE_STATUS_ORDER.map((status) => ({
    status,
    counted: !UNCOUNTED.includes(status),
    features: members
      .filter((f) => f.status === status)
      .sort(byPriority)
      .map((f) => ({ id: f.id, priority: f.priority, title: f.title })),
  })).filter((g) => g.features.length > 0);
  const blocking = groups
    .filter((g) => g.counted && g.status !== "done")
    .flatMap((g) => g.features.map((f) => f.id));
  return {
    milestone,
    groups,
    blocking,
    ready: milestoneReady(milestone),
    started_while_planned: milestoneStartedWhilePlanned(milestone),
  };
}

type Section = (page: MilestonePage) => string[];

function headerSection({ milestone: m }: MilestonePage): string[] {
  const released = m.status === "released" && m.released_at ? ` ${m.released_at}` : "";
  const target = m.target ? `, target ${m.target}` : "";
  return [
    `${m.id} ${m.title}`,
    `Status: ${m.status}${released}${target}`,
    ...(m.goal.trim() ? [`Goal: ${m.goal}`] : []),
    `Progress: ${m.progress.done}/${m.progress.total} done`,
  ];
}

function groupsSection(page: MilestonePage): string[] {
  return page.groups.flatMap((g) => [
    `${g.status} (${g.features.length}${g.counted ? "" : ", not counted"})`,
    ...g.features.map((f) => `  ${f.id} ${f.priority} ${f.title}`),
  ]);
}

// A released milestone is finished, so whether it is ready says nothing.
function readinessSection(page: MilestonePage): string[] {
  const m = page.milestone;
  if (m.status !== "planned" && m.status !== "active") return [];
  const state =
    m.progress.total === 0
      ? "No features count toward it yet."
      : page.ready
        ? `Ready: every feature is done; ask the user to release ${m.id}.`
        : `Keeping it from being ready: ${page.blocking.join(", ")}`;
  const started = page.started_while_planned
    ? [`Work has started on its features but it is still planned: azimuth move ${m.id} active`]
    : [];
  return [state, ...started];
}

// Sections are listed rather than inlined so that F-028 can add its release and commits ones.
const SECTIONS: Section[] = [headerSection, groupsSection, readinessSection];

/**
 * The page as text, without a trailing newline: the non-empty results of the section
 * functions, in order, joined by one blank line.
 */
export function formatMilestonePage(page: MilestonePage): string {
  return SECTIONS.map((section) => section(page))
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join("\n"))
    .join("\n\n");
}
