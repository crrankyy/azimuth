import type { Index } from "../../../../src/core/types";
import type { ActivityKind } from "./feed";
import type { ActivityData, SessionStatus } from "./sessions";

export type ThreadEntry =
  /** "└ explorer map retry call sites · 4m"; duration null while it runs ("running"). */
  | {
      kind: "subagent";
      at: string;
      agent: string;
      text: string;
      duration: string | null;
      href: string;
    }
  /** at null and subject "Not in the index" for a SHA the index doesn't have. */
  | { kind: "commit"; at: string | null; sha: string; subject: string; refs: string[] }
  /** text "R-0140 passed · 1.3 s" | "R-0142 failed · 2.1 s". */
  | { kind: "run"; at: string; id: string; ok: boolean; text: string; target: string }
  | { kind: "question"; at: string; id: string; title: string }
  | { kind: "adr"; at: string | null; id: string; title: string }
  | { kind: "issue"; at: null; id: string; title: string };

export interface SessionThread {
  status: SessionStatus;
  /** Timed entries oldest first (ties: subagent, commit, run, question, adr), then untimed ones. */
  entries: ThreadEntry[];
  /** Subagents in the joined live session, before filters. */
  subagents: number;
  /** The session's runs, before filters. */
  runs: { total: number; failed: number };
  pickedUp: { id: string; at: string } | null;
  /** "#/agents/<live.claude_session>" when live.main.transcript is true, else null. */
  transcript: string | null;
}

/** One thread per persisted session, keyed by SES ID. */
export function sessionThreads(
  index: Index,
  data: ActivityData,
  _options: { now: number; kinds: ReadonlySet<ActivityKind> },
): Map<string, SessionThread> {
  return new Map(
    index.sessions.map((s) => [
      s.id,
      {
        status: data.byKey.get(s.id)?.status ?? (s.ended_at ? "done" : "open"),
        entries: [],
        subagents: 0,
        runs: { total: 0, failed: 0 },
        pickedUp: null,
        transcript: null,
      },
    ]),
  );
}
