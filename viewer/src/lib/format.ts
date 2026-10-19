/** Times relative to "now" and short dates, as the handoff screens show them. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7m", "1h", "2d", "3w" (Inbox ages). */
export function age(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

/** "7m ago", "just now". */
export function ago(iso: string | null | undefined, now: number): string {
  const a = age(iso, now);
  if (!a) return "";
  return a === "now" ? "just now" : `${a} ago`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The calendar day of a value: a date ("2026-10-18") as written, since it names a day rather than
 * a moment; a timestamp in the viewer's local time zone (files store UTC).
 */
function calendar(iso: string): { year: number; month: number; day: number } | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (date) return { year: Number(date[1]), month: Number(date[2]) - 1, day: Number(date[3]) };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** "2026-10-17": the local day of a timestamp (a date as written), for grouping by day. */
export function localDay(iso: string): string {
  const c = calendar(iso);
  return c ? `${c.year}-${pad(c.month + 1)}-${pad(c.day)}` : iso.slice(0, 10);
}

/** "Oct 9" (dates as written, timestamps in local time). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const c = calendar(iso);
  return c ? `${MONTHS[c.month]} ${c.day}` : iso;
}

/** "Oct 14, 2026" (dates as written, timestamps in local time); "" for null. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const c = calendar(iso);
  return c ? `${MONTHS[c.month]} ${c.day}, ${c.year}` : iso;
}

/** "11:56" (local time). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Oct 18, 12:05". */
export function dateTime(iso: string | null | undefined): string {
  return iso ? `${shortDate(iso)}, ${clock(iso)}` : "";
}

/** Whole days from now until a date's local midnight (negative when past). */
export function daysUntil(date: string | null | undefined, now: number): number | null {
  const c = date ? calendar(date) : null;
  if (!c) return null;
  return Math.ceil((new Date(c.year, c.month, c.day).getTime() - now) / 86_400_000);
}

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

/** "2.14 s", "58m". */
export function duration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "2.1 s" for dense lists of runs; longer runs fall back to "3m". */
export function shortDuration(ms: number): string {
  // Round in tenths first: 1650 ms as a float is 1.6499…, which toFixed(1) shows as 1.6.
  return ms < 60_000 ? `${(Math.round(ms / 100) / 10).toFixed(1)} s` : duration(ms);
}

/** Day heading for activity feeds, in local days: "Today · Sunday, Oct 18". */
export function dayHeading(iso: string, now: number): string {
  const c = calendar(iso);
  if (!c) return iso;
  const day = new Date(c.year, c.month, c.day);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const label = `${day.toLocaleDateString("en-US", { weekday: "long" })}, ${shortDate(iso)}`;
  if (localDay(iso) === localDay(new Date(now).toISOString())) return `Today · ${label}`;
  if (localDay(iso) === localDay(yesterday.toISOString())) return `Yesterday · ${label}`;
  return label;
}

/**
 * A duration: "45s" under a minute; "4m 01s" under ten minutes ("5m" when the seconds are 0);
 * "25m" under an hour; "1h 05m" after ("2h" when the minutes are 0). Negative input → "0s".
 */
export function elapsed(_ms: number): string {
  return "";
}

/** "just now" under 5 s, "48s ago" under a minute, else ago(iso, now); "" for null. */
export function liveAgo(_iso: string | null | undefined, _now: number): string {
  return "";
}

/** "12:01:04" in local time; "" for null. */
export function clockSeconds(_iso: string | null | undefined): string {
  return "";
}
