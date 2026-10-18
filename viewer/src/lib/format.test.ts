import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clock, dateTime, dayHeading, daysUntil, localDay, shortDate } from "./format";

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
