import type { ReactNode } from "react";
import type { TimelineLayout, TimelineRange } from "./timeline";

/** The Agent timeline section: range toggle, ticks, now line, rows, legend and the earlier line. */
export function AgentTimeline(_props: {
  layout: TimelineLayout;
  range: TimelineRange;
  onRange: (range: TimelineRange) => void;
}): ReactNode {
  return <section className="az-card tl" aria-label="Agent timeline" />;
}
