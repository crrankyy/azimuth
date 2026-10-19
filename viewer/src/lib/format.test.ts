import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clock,
  clockSeconds,
  dateTime,
  dayHeading,
  daysUntil,
  elapsed,
  liveAgo,
  localDay,
  shortDate,
} from "./format";

// A zone behind UTC, so a timestamp early on Oct 18 UTC falls on Oct 17 locally.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const EARLY = "2026-10-18T03:30:00Z"; // Oct 17, 20:30 in Los Angeles

describe("BUG-0030 times in the viewer's local time zone", () => {
  it("shows timestamps in local time", () => {
    expect(clock(EARLY)).toBe("20:30");
    expect(shortDate(EARLY)).toBe("Oct 17");
    expect(dateTime(EARLY)).toBe("Oct 17, 20:30");
    expect(localDay(EARLY)).toBe("2026-10-17");
  });

  it("keeps a date as written", () => {
    expect(shortDate("2026-10-18")).toBe("Oct 18");
    expect(localDay("2026-10-18")).toBe("2026-10-18");
  });

  it("names local days in headings", () => {
    const now = Date.parse("2026-10-18T05:00:00Z"); // Oct 17, 22:00 locally
    expect(dayHeading(EARLY, now)).toBe("Today · Saturday, Oct 17");
    expect(dayHeading("2026-10-17T03:00:00Z", now)).toBe("Yesterday · Friday, Oct 16");
    expect(dayHeading("2026-10-16", now)).toBe("Yesterday · Friday, Oct 16");
  });

  it("counts days until a date from local midnight", () => {
    // From Oct 17, 22:00 to Oct 20, 00:00 is 2 days and 2 hours.
    expect(daysUntil("2026-10-20", Date.parse("2026-10-18T05:00:00Z"))).toBe(3);
  });
});

describe("F-015 live durations and times", () => {
  // The agent screens' fixture is in UTC, so local times are the times as written.
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });

  const NOW = Date.parse("2026-10-18T12:05:00Z");

  it("S-015.6.1 formats durations by size", () => {
    const ms = [45_000, 72_000, 241_000, 300_000, 1_500_000, 3_900_000, 7_200_000];
    expect(ms.map(elapsed)).toEqual(["45s", "1m 12s", "4m 01s", "5m", "25m", "1h 05m", "2h"]);
  });

  it("S-015.6.2 formats recent times and clock times with seconds", () => {
    expect(liveAgo("2026-10-18T12:04:58Z", NOW)).toBe("just now");
    expect(liveAgo("2026-10-18T12:04:12Z", NOW)).toBe("48s ago");
    expect(liveAgo("2026-10-18T11:58:00Z", NOW)).toBe("7m ago");
    expect(clockSeconds("2026-10-18T12:01:04Z")).toBe("12:01:04");
  });

  it("S-015.6.3 formats a negative duration and missing times as nothing", () => {
    expect(elapsed(-5)).toBe("0s");
    expect(liveAgo(null, NOW)).toBe("");
    expect(clockSeconds(null)).toBe("");
  });
});
