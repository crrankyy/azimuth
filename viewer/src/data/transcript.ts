import { useEffect, useRef, useState } from "react";
import type { TranscriptEntry, TranscriptPage } from "../../../src/core/types";
import { pageToken, useIndexState } from "./IndexProvider";

/** One agent's transcript as loaded so far. */
export interface TranscriptState {
  entries: TranscriptEntry[];
  /** The offset to request next; null until the first page arrives. */
  next: number | null;
  /** The first page didn't start at the beginning of the file. */
  skipped: boolean;
  /** The last request's failure, cleared by the next success. */
  error: string | null;
}

export const EMPTY_TRANSCRIPT: TranscriptState = {
  entries: [],
  next: null,
  skipped: false,
  error: null,
};

export type TranscriptFetch =
  { ok: true; page: TranscriptPage } | { ok: false; status: number; message: string };

/** "/api/transcript/<encoded session>", then "?agent=<id>" and "after=<n>" when given. */
export function transcriptUrl(
  claudeSession: string,
  agent: string | null,
  after: number | null,
): string {
  const query = new URLSearchParams();
  if (agent !== null) query.set("agent", agent);
  if (after !== null) query.set("after", String(after));
  const base = `/api/transcript/${encodeURIComponent(claudeSession)}`;
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

function isPage(body: unknown): body is TranscriptPage {
  const page = body as Partial<TranscriptPage> | null;
  return page?.ok === true && Array.isArray(page.entries) && typeof page.next === "number";
}

/** The refusal's message, else "<status> <error>" (the token check sends no message). */
function refusal(status: number, body: unknown): TranscriptFetch {
  const { message, error } = (body ?? {}) as { message?: unknown; error?: unknown };
  if (typeof message === "string" && message) return { ok: false, status, message };
  if (typeof error === "string") return { ok: false, status, message: `${status} ${error}` };
  return { ok: false, status, message: "The server sent no transcript page." };
}

/**
 * GET transcriptUrl(…) with header x-azimuth-token. 200 → { ok: true, page }. Any other status →
 * { ok: false, status, message: body.message, else `${status} ${body.error}` }. A rejected fetch
 * → { ok: false, status: 0, message: "Couldn't reach azimuth view." }.
 */
export async function fetchTranscript(
  req: { token: string; claudeSession: string; agent: string | null; after: number | null },
  fetchImpl: typeof fetch = fetch,
): Promise<TranscriptFetch> {
  let res: Response;
  try {
    res = await fetchImpl(transcriptUrl(req.claudeSession, req.agent, req.after), {
      headers: { "x-azimuth-token": req.token },
    });
  } catch {
    return { ok: false, status: 0, message: "Couldn't reach azimuth view." };
  }
  // A body that isn't JSON (a proxy's error page, say) still reports the status.
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 200 && isPage(body)) return { ok: true, page: body };
  return refusal(res.status, body);
}

type ResultEntry = Extract<TranscriptEntry, { kind: "result" }>;

/** The call entry with a result's status, and its diff, output and agent when it has them. */
function completed(call: TranscriptEntry, result: ResultEntry): TranscriptEntry {
  if (call.kind === "tool")
    return {
      ...call,
      status: result.status,
      diff: result.diff ?? call.diff,
      output: result.output ?? call.output,
    };
  if (call.kind === "spawn")
    return {
      ...call,
      status: result.status,
      output: result.output ?? call.output,
      agent_id: result.agent_id ?? call.agent_id,
    };
  return call;
}

function isCall(entry: TranscriptEntry, toolUseId: string): boolean {
  return (entry.kind === "tool" || entry.kind === "spawn") && entry.tool_use_id === toolUseId;
}

function merged(loaded: TranscriptEntry[], incoming: TranscriptEntry[]): TranscriptEntry[] {
  const out = [...loaded];
  for (const entry of incoming) {
    if (entry.kind !== "result") {
      out.push(entry);
      continue;
    }
    const at = out.findLastIndex((e) => isCall(e, entry.tool_use_id));
    const call = out[at];
    // A result whose call came before the loaded window has nothing to complete.
    if (call) out[at] = completed(call, entry);
  }
  return out;
}

/**
 * A successful page: appends its entries, except `result` entries, which update the loaded tool or
 * spawn entry with the same tool_use_id (status; diff, output and agent_id when not null) and are
 * dropped when there is none; next = page.next; skipped from the first page only; error null.
 * A failure: entries, next and skipped unchanged, error = message.
 */
export function applyTranscript(state: TranscriptState, result: TranscriptFetch): TranscriptState {
  if (!result.ok) return { ...state, error: result.message };
  const { page } = result;
  return {
    entries: merged(state.entries, page.entries),
    next: page.next,
    // A later skipped page is a single oversized line, not a gap before the view's start.
    skipped: state.next === null ? page.skipped : state.skipped,
    error: null,
  };
}

/**
 * The loaded transcript of one agent. Disabled: EMPTY_TRANSCRIPT and no request. Otherwise it
 * resets and requests the first page when the session or agent changes, and requests from `next`
 * whenever index.live changes, one request at a time (a change during a request queues one more).
 */
export function useTranscript(
  claudeSession: string,
  agentId: string | null,
  enabled: boolean,
): TranscriptState {
  const live = useIndexState().index?.live;
  const view = `${claudeSession}/${agentId ?? ""}`;
  const [loaded, setLoaded] = useState({ view, transcript: EMPTY_TRANSCRIPT });
  const pull = useRef<() => void>(() => {});
  const seenLive = useRef(live);

  useEffect(() => {
    const token = pageToken();
    if (!enabled || !token) return;
    let current = EMPTY_TRANSCRIPT;
    let inFlight = false;
    let queued = false;
    let shown = true;
    const request = () => {
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      fetchTranscript({ token, claudeSession, agent: agentId, after: current.next }).then(
        (result) => {
          // The view moved on to another session or agent: this answer isn't its transcript.
          if (!shown) return;
          current = applyTranscript(current, result);
          setLoaded({ view, transcript: current });
          inFlight = false;
          if (!queued) return;
          queued = false;
          request();
        },
      );
    };
    pull.current = request;
    request();
    return () => {
      shown = false;
      pull.current = () => {};
    };
  }, [view, claudeSession, agentId, enabled]);

  useEffect(() => {
    // The view's own effect already asked for the first page with this live state.
    if (seenLive.current === live) return;
    seenLive.current = live;
    pull.current();
  }, [live]);

  return enabled && loaded.view === view ? loaded.transcript : EMPTY_TRANSCRIPT;
}
