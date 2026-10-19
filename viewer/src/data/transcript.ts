import type { TranscriptEntry, TranscriptPage } from "../../../src/core/types";

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
  _claudeSession: string,
  _agent: string | null,
  _after: number | null,
): string {
  return "";
}

/**
 * GET transcriptUrl(…) with header x-azimuth-token. 200 → { ok: true, page }. Any other status →
 * { ok: false, status, message: body.message, else `${status} ${body.error}` }. A rejected fetch
 * → { ok: false, status: 0, message: "Couldn't reach azimuth view." }.
 */
export async function fetchTranscript(
  _req: { token: string; claudeSession: string; agent: string | null; after: number | null },
  _fetchImpl?: typeof fetch,
): Promise<TranscriptFetch> {
  return { ok: false, status: 0, message: "" };
}

/**
 * A successful page: appends its entries, except `result` entries, which update the loaded tool or
 * spawn entry with the same tool_use_id (status; diff, output and agent_id when not null) and are
 * dropped when there is none; next = page.next; skipped from the first page only; error null.
 * A failure: entries, next and skipped unchanged, error = message.
 */
export function applyTranscript(state: TranscriptState, _result: TranscriptFetch): TranscriptState {
  return state;
}

/**
 * The loaded transcript of one agent. Disabled: EMPTY_TRANSCRIPT and no request. Otherwise it
 * resets and requests the first page when the session or agent changes, and requests from `next`
 * whenever index.live changes, one request at a time (a change during a request queues one more).
 */
export function useTranscript(
  _claudeSession: string,
  _agentId: string | null,
  _enabled: boolean,
): TranscriptState {
  return EMPTY_TRANSCRIPT;
}
