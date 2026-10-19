import type { Index, LiveSession } from "../../../../src/core/types";
import { Page } from "../../components/AppShell";
import type { TranscriptState } from "../../data/transcript";
import { href } from "../../lib/router";

export interface AgentTranscriptProps {
  index: Index;
  session: LiveSession;
  /** Null: the main agent's tab. */
  agentId: string | null;
  transcript: TranscriptState;
  now: number;
  /** "Following live": keep the newest entry in view. */
  follow: boolean;
  onFollow: (on: boolean) => void;
  /** "Show all tool output". */
  showAll: boolean;
  onShowAll: (on: boolean) => void;
}

/** Empty states (feature.md order), then AgentTranscript with useTranscript, keys and local follow/showAll state. */
export function AgentTranscriptScreen({
  claudeSession,
}: {
  claudeSession: string;
  agentId: string | null;
}) {
  return (
    <Page crumbs={[{ label: "Agents", href: href("agents") }, { label: claudeSession }]}>
      {null}
    </Page>
  );
}

/** One agent's live transcript: header, agent tabs, entries and the side panel. */
export function AgentTranscript(_props: AgentTranscriptProps) {
  return <div />;
}
