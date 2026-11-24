import { describe, expect, it } from "vitest";
import { endOfDay, formatDateLong, formatTimeRange, wallTimeToInstant } from "./dates";
import { formatMoney, parseMoney } from "./money";

describe("dates", () => {
  it("converts wall times across daylight saving", () => {
    expect(new Date(wallTimeToInstant("2027-01-15T15:00", "Australia/Sydney")).toISOString()).toBe("2027-01-15T04:00:00.000Z");
    expect(new Date(wallTimeToInstant("2027-07-15T15:00", "Australia/Sydney")).toISOString()).toBe("2027-07-15T05:00:00.000Z");
    expect(new Date(endOfDay("2027-07-15", "Australia/Sydney")).toISOString()).toBe("2027-07-15T13:59:59.999Z");
  });
  it("handles DST transitions at midnight", () => {
    // Santiago falls back at midnight: the deadline day still ends at local midnight.
    expect(new Date(endOfDay("2027-04-03", "America/Santiago")).toISOString()).toBe("2027-04-04T03:59:59.999Z");
    // Sydney's fall-back hour (2–3 am) is ambiguous: take the earlier one.
    expect(new Date(wallTimeToInstant("2027-04-04T02:30", "Australia/Sydney")).toISOString()).toBe("2027-04-03T15:30:00.000Z");
    // Sydney's spring-forward gap (2–3 am doesn't exist): land after the jump.
    expect(new Date(wallTimeToInstant("2027-10-03T02:30", "Australia/Sydney")).toISOString()).toBe("2027-10-02T16:30:00.000Z");
  });
  it("formats for Australian readers", () => {
    expect(formatDateLong("2027-03-13")).toBe("Saturday 13 March 2027");
    expect(formatTimeRange("2027-03-13T15:30", "2027-03-13T23:00")).toBe("3:30 pm – 11:00 pm");
    expect(formatTimeRange(null, null)).toBe("Time to be announced");
  });
});

describe("money", () => {
  it("parses and formats cents", () => {
    expect(parseMoney("$1,250.5")).toBe(125050);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNaN();
    expect(parseMoney("A$50")).toBe(5000);
    expect(parseMoney("£12.5")).toBe(1250);
    expect(parseMoney(".50")).toBe(50);
    expect(parseMoney("AUD 20")).toBe(2000);
    expect(parseMoney("99999999999")).toBeNaN();
    expect(formatMoney(125050, "AUD")).toBe("$1,250.50");
    expect(formatMoney(5000, "AUD")).toBe("$50");
  });
});
