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

/** "Oct 9" (dates or timestamps, UTC). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "11:56" (UTC). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "Oct 18, 12:05". */
export function dateTime(iso: string | null | undefined): string {
  return iso ? `${shortDate(iso)}, ${clock(iso)}` : "";
}

/** Whole days from now until a date (negative when past). */
export function daysUntil(date: string | null | undefined, now: number): number | null {
  if (!date) return null;
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - now) / 86_400_000);
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

/** Day heading for activity feeds: "Today · Sunday, Oct 18". */
export function dayHeading(iso: string, now: number): string {
  const d = new Date(iso);
  const today = new Date(now);
  const sameDay = (a: Date, b: Date) =>
    a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000);
  const name = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const label = `${name}, ${shortDate(iso)}`;
  if (sameDay(d, today)) return `Today · ${label}`;
  if (sameDay(d, yesterday)) return `Yesterday · ${label}`;
  return label;
}
