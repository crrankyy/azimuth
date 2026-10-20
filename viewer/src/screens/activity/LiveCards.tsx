import type { ReactNode } from "react";
import type { ActivityData, ActivitySession } from "./sessions";

/** Activity sessions whose status is running or waiting: running first, each group oldest first. */
export function liveCards(_data: ActivityData): ActivitySession[] {
  return [];
}

/** The card grid; renders nothing for an empty list. Each card links to "#/agents/<claude-session>" and has id "ses-<SES>" when it has a SES. */
export function LiveCards(_props: { sessions: ActivitySession[]; now: number }): ReactNode {
  return null;
}
