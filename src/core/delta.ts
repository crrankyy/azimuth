import type { Model } from "./model";

/** Something you did (in the viewer or the CLI) that a running agent should know about. */
export interface UserEvent {
  at: string;
  /** The feature, decision or question it concerns. */
  ref: string;
  /** Feature the event belongs to, for filtering by what an agent is working on. */
  feature: string | null;
  text: string;
  /** Identifies the event, so one reported at a cursor's own second isn't reported twice. */
  key: string;
}

/** Where a reader left off: a time, plus the events at exactly that second already seen. */
export interface Cursor {
  at: string;
  keys: string[];
}

/** Your answers, reviews, moves, decisions and acknowledgements after the cursor, oldest first. */
export function userEventsSince(model: Model, cursor: Cursor): UserEvent[] {
  const since = Date.parse(cursor.at);
  const after = (at: string | null | undefined) => Boolean(at) && Date.parse(at as string) >= since;
  const events: Omit<UserEvent, "key">[] = [];
  for (const q of model.questions) {
    if (!q.answer || !after(q.answer.answered_at)) continue;
    const option = q.options.find((o) => o.key === q.answer?.option);
    const what = [option?.label, q.answer.text].filter(Boolean).join(" — ");
    events.push({
      at: q.answer.answered_at,
      ref: q.id,
      feature: q.feature,
      text: `answered ${q.id} (${q.title}): ${what}. Apply it, then \`azimuth resolve ${q.id}\`.`,
    });
  }
  for (const f of model.features) {
    for (const entry of f.log) {
      if (entry.actor !== "you" || !after(entry.at)) continue;
      const first = entry.body.split("\n")[0] ?? "";
      const text =
        entry.type === "review"
          ? `requested changes on ${f.id}: ${entry.body}`
          : entry.type === "transition"
            ? `moved ${f.id} ${first}`
            : `noted on ${f.id}: ${entry.body}`;
      events.push({ at: entry.at, ref: f.id, feature: f.id, text });
    }
    if (after(f.review_ack_at)) {
      events.push({
        at: f.review_ack_at as string,
        ref: f.id,
        feature: f.id,
        text: `acknowledged the automatic approval of ${f.id}`,
      });
    }
  }
  for (const d of model.decisions) {
    if (d.decided_by === "you" && after(d.decided_at)) {
      events.push({
        at: d.decided_at as string,
        ref: d.id,
        feature: null,
        text: `${d.status} ${d.id} (${d.title})`,
      });
    }
    if (after(d.review_ack_at)) {
      events.push({
        at: d.review_ack_at as string,
        ref: d.id,
        feature: null,
        text: `acknowledged the automatic acceptance of ${d.id}`,
      });
    }
  }
  const seen = new Set(cursor.keys);
  return events
    .map((e) => ({ ...e, key: `${e.ref}|${e.at}|${e.text}` }))
    .filter((e) => Date.parse(e.at) > since || !seen.has(e.key))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** The cursor after reporting `events` (they are sorted oldest first). */
export function advance(cursor: Cursor, events: UserEvent[]): Cursor {
  const last = events.at(-1);
  if (!last) return cursor;
  const at = last.at;
  const sameSecond = events.filter((e) => e.at === at).map((e) => e.key);
  return { at, keys: at === cursor.at ? [...cursor.keys, ...sameSecond] : sameSecond };
}

export function describeEvents(events: UserEvent[]): string {
  return events.map((e) => `- The user ${e.text}`).join("\n");
}
