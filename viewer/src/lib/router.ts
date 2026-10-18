import { useEffect, useState } from "react";

/**
 * Hash routes, so the viewer works from a `file://` export as well as the server:
 * `#/inbox`, `#/features`, `#/features/F-005/plan`, `#/questions/Q-0003`, `#/roadmap/graph`…
 */
export type Section =
  | "inbox"
  | "overview"
  | "roadmap"
  | "features"
  | "decisions"
  | "questions"
  | "issues"
  | "activity"
  | "verification"
  | "knowledge";

export const SECTIONS: Section[] = [
  "inbox",
  "overview",
  "roadmap",
  "features",
  "decisions",
  "questions",
  "issues",
  "activity",
  "verification",
  "knowledge",
];

export interface Route {
  section: Section;
  /** Entity ID or sub-view (`F-005`, `graph`, `architecture`). */
  id: string | null;
  /** Tab inside an entity view (`plan`, `stories`). */
  tab: string | null;
}

export function parseRoute(hash: string): Route {
  const [section, id, tab] = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const known = SECTIONS.includes(section as Section) ? (section as Section) : "inbox";
  return { section: known, id: id || null, tab: tab || null };
}

export function href(section: Section, id?: string | null, tab?: string | null): string {
  return `#/${[section, id, tab]
    .filter(Boolean)
    .map((p) => encodeURIComponent(p as string))
    .join("/")}`;
}

export function navigate(to: string): void {
  if (window.location.hash !== to) window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** The section that shows an entity, by ID prefix. */
export function routeForId(id: string): string {
  if (/^F-\d{3}$/.test(id)) return href("features", id);
  if (/^(ST|S)-\d{3}\./.test(id))
    return href("features", `F-${id.split("-")[1]?.slice(0, 3)}`, "stories");
  if (/^T-\d{3}\./.test(id)) return `${href("features", `F-${id.slice(2, 5)}`, "plan")}/${id}`;
  if (/^ADR-/.test(id)) return href("decisions", id);
  if (/^Q-/.test(id)) return href("questions", id);
  if (/^(BUG|DEBT|RISK)-/.test(id)) return href("issues", id);
  if (/^SES-/.test(id)) return href("activity", id);
  if (/^R-/.test(id)) return href("verification", id);
  if (/^M-/.test(id)) return href("roadmap");
  return href("inbox");
}
