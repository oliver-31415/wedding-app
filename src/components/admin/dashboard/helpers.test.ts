import { describe, expect, it } from "vitest";
import {
  excerptNote,
  firstName,
  formatActivityAction,
  formatWeddingDateHeader,
  getSetupChecklist,
} from "./helpers";

describe("firstName", () => {
  it("extracts the first word of a name", () => {
    expect(firstName("Alex Smith")).toBe("Alex");
    expect(firstName("  Sam  ")).toBe("Sam");
    expect(firstName("   ")).toBe("there");
  });
});

describe("formatWeddingDateHeader", () => {
  const tz = "Australia/Sydney";

  it("returns null when no date is set", () => {
    expect(formatWeddingDateHeader(null, tz)).toBeNull();
  });

  it("formats future, today, and past dates", () => {
    const now = Date.UTC(2027, 2, 10, 2, 0, 0); // 10 March 2027 in Sydney
    expect(formatWeddingDateHeader("2027-03-13", tz, now)).toBe("3 days to go · Saturday 13 March 2027");
    expect(formatWeddingDateHeader("2027-03-11", tz, now)).toBe("1 day to go · Thursday 11 March 2027");
    expect(formatWeddingDateHeader("2027-03-10", tz, now)).toBe("Today · Wednesday 10 March 2027");
    expect(formatWeddingDateHeader("2027-03-08", tz, now)).toBe("Monday 8 March 2027");
  });
});

describe("getSetupChecklist", () => {
  it("returns only unfinished items", () => {
    const res = getSetupChecklist({
      hasPages: true,
      hasEvents: true,
      hasGuests: true,
      hasRsvpDeadline: true,
      isPublished: false,
    });
    expect(res.completedCount).toBe(4);
    expect(res.totalCount).toBe(5);
    expect(res.unfinished.map((i) => i.id)).toEqual(["publish"]);
    expect(res.unfinished[0].href).toBe("/admin/settings/site-access");
  });

  it("returns empty unfinished list when all steps are done", () => {
    const res = getSetupChecklist({
      hasPages: true,
      hasEvents: true,
      hasGuests: true,
      hasRsvpDeadline: true,
      isPublished: true,
    });
    expect(res.unfinished).toEqual([]);
    expect(res.completedCount).toBe(5);
  });

  it("returns all five steps for a brand-new wedding", () => {
    const res = getSetupChecklist({
      hasPages: false,
      hasEvents: false,
      hasGuests: false,
      hasRsvpDeadline: false,
      isPublished: false,
    });
    expect(res.unfinished.map((i) => i.href)).toEqual([
      "/admin/website",
      "/admin/schedule",
      "/admin/guests",
      "/admin/rsvp/settings",
      "/admin/settings/site-access",
    ]);
  });
});

describe("formatActivityAction", () => {
  it("uses exact wording for guest and host events", () => {
    expect(formatActivityAction("guest", "first")).toBe("replied");
    expect(formatActivityAction("guest", "update")).toBe("updated their RSVP");
    expect(formatActivityAction("host", "first")).toBe("RSVP edited by you");
    expect(formatActivityAction("host", "update")).toBe("RSVP edited by you");
  });
});

describe("excerptNote", () => {
  it("collapses whitespace and truncates long notes", () => {
    expect(excerptNote(null)).toBeNull();
    expect(excerptNote("   ")).toBeNull();
    expect(excerptNote("Can't wait!\nSee you there.")).toBe("Can't wait! See you there.");
    const long = "a".repeat(200);
    const out = excerptNote(long, 50);
    expect(out?.length).toBeLessThanOrEqual(50);
    expect(out?.endsWith("…")).toBe(true);
  });
});
