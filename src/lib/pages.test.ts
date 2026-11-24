import { describe, expect, it } from "vitest";
import {
  addablePageTypes,
  buildEventIcs,
  buildGoogleCalendarUrl,
  buildGoogleMapsUrl,
  canAddPageType,
  PAGE_TYPE_META,
  pageUrl,
  parseEventTimes,
  resolveHomeLanding,
  safeNextPath,
  selectNavPages,
  splitWallTime,
  uniqueCustomSlug,
  validateCustomSlug,
} from "./pages";

describe("PAGE_TYPE_META & addablePageTypes", () => {
  it("defines the fixed slugs specified in conventions", () => {
    expect(PAGE_TYPE_META.home.fixedSlug).toBe("");
    expect(PAGE_TYPE_META.schedule.fixedSlug).toBe("schedule");
    expect(PAGE_TYPE_META.story.fixedSlug).toBe("story");
    expect(PAGE_TYPE_META.party.fixedSlug).toBe("wedding-party");
    expect(PAGE_TYPE_META.faq.fixedSlug).toBe("faq");
    expect(PAGE_TYPE_META.gifts.fixedSlug).toBe("gifts");
    expect(PAGE_TYPE_META.rsvp.fixedSlug).toBe("rsvp");
    expect(PAGE_TYPE_META.custom.fixedSlug).toBeNull();
  });

  it("allows each non-custom type at most once, and custom multiple times", () => {
    const existing = [{ type: "home" as const }, { type: "schedule" as const }, { type: "custom" as const }];
    const addable = addablePageTypes(existing).map((m) => m.type);
    expect(addable).not.toContain("home");
    expect(addable).not.toContain("schedule");
    expect(addable).toContain("story");
    expect(addable).toContain("party");
    expect(addable).toContain("faq");
    expect(addable).toContain("gifts");
    expect(addable).toContain("rsvp");
    expect(addable).toContain("custom");

    expect(canAddPageType("home", existing)).toBe(false);
    expect(canAddPageType("story", existing)).toBe(true);
    expect(canAddPageType("custom", existing)).toBe(true);
  });
});

describe("custom slug validation", () => {
  it("normalises and accepts valid custom slugs", () => {
    expect(validateCustomSlug("Dress Code & Tips", ["schedule", "faq"])).toEqual({
      ok: true,
      slug: "dress-code-and-tips",
    });
  });

  it("rejects empty, reserved, and duplicate slugs", () => {
    expect(validateCustomSlug("   ", []).ok).toBe(false);
    expect(validateCustomSlug("!!!", []).ok).toBe(false);

    for (const reserved of ["schedule", "story", "wedding-party", "faq", "gifts", "rsvp", "unlock", "find", "i", "event"]) {
      const res = validateCustomSlug(reserved, []);
      expect(res.ok).toBe(false);
    }

    expect(validateCustomSlug("parking", ["parking"]).ok).toBe(false);
    // Allows keeping the page's own slug when editing
    expect(validateCustomSlug("parking", ["parking"], "parking")).toEqual({ ok: true, slug: "parking" });
  });

  it("generates unique non-reserved custom slugs", () => {
    expect(uniqueCustomSlug("Parking", ["faq"])).toBe("parking");
    expect(uniqueCustomSlug("Parking", ["parking"])).toBe("parking-2");
    expect(uniqueCustomSlug("Parking", ["parking", "parking-2"])).toBe("parking-3");
    expect(uniqueCustomSlug("Schedule", [])).toBe("schedule-2");
    expect(uniqueCustomSlug("Event", [])).toBe("event-2");
    expect(uniqueCustomSlug("???", [])).toBe("page");
  });
});

describe("nav ordering and home landing", () => {
  const sample = [
    { type: "faq" as const, slug: "faq", position: 2 },
    { type: "home" as const, slug: "", position: 0 },
    { type: "rsvp" as const, slug: "rsvp", position: 3 },
    { type: "schedule" as const, slug: "schedule", position: 1 },
    { type: "custom" as const, slug: "secret", position: 4 },
  ];

  it("sorts nav pages and keeps only ok and needs_password", () => {
    const nav = selectNavPages(sample, (p) => {
      if (p.slug === "rsvp") return "needs_password";
      if (p.slug === "faq") return "hidden";
      if (p.slug === "secret") return "needs_guest";
      return "ok";
    });
    expect(nav.map((p) => p.slug)).toEqual(["", "schedule", "rsvp"]);
  });

  it("formats home URL to /w/slug and others to /w/slug/page", () => {
    expect(pageUrl("/w/alex-and-sam", "")).toBe("/w/alex-and-sam");
    expect(pageUrl("/w/alex-and-sam", "faq")).toBe("/w/alex-and-sam/faq");
    expect(pageUrl("", "")).toBe("/");
    expect(pageUrl("", "faq")).toBe("/faq");
  });

  it("resolves home landing correctly", () => {
    expect(resolveHomeLanding(sample, () => "ok")).toEqual({
      kind: "render",
      page: { type: "home", slug: "", position: 0 },
    });

    // When home is hidden, redirects to first viewable page in position order
    expect(resolveHomeLanding(sample, (p) => (p.type === "home" ? "hidden" : "ok"))).toEqual({
      kind: "redirect",
      slug: "schedule",
    });

    // When only password-protected home exists
    expect(
      resolveHomeLanding([{ type: "home", slug: "", position: 0 }], () => "needs_password"),
    ).toEqual({ kind: "unlock" });

    // When no pages exist at all
    expect(resolveHomeLanding([], () => "ok")).toEqual({ kind: "empty" });
  });
});

describe("safeNextPath", () => {
  it("allows same-wedding paths and blocks open redirects", () => {
    expect(safeNextPath("/w/alex-and-sam", "/w/alex-and-sam")).toBe("/w/alex-and-sam");
    expect(safeNextPath("/w/alex-and-sam/rsvp", "/w/alex-and-sam")).toBe("/w/alex-and-sam/rsvp");
    expect(safeNextPath("/w/alex-and-sam/rsvp?step=2", "/w/alex-and-sam")).toBe("/w/alex-and-sam/rsvp?step=2");

    expect(safeNextPath("https://evil.example", "/w/alex-and-sam")).toBe("/w/alex-and-sam");
    expect(safeNextPath("//evil.example/w/alex-and-sam", "/w/alex-and-sam")).toBe("/w/alex-and-sam");
    expect(safeNextPath("/w/alex-and-sam-other/rsvp", "/w/alex-and-sam")).toBe("/w/alex-and-sam");
    expect(safeNextPath("/w/alex-and-sam/../admin", "/w/alex-and-sam")).toBe("/w/alex-and-sam");
    expect(safeNextPath("/admin", "/w/alex-and-sam")).toBe("/w/alex-and-sam");
    expect(safeNextPath(null, "/w/alex-and-sam")).toBe("/w/alex-and-sam");
  });
});

describe("event times & calendar builders", () => {
  it("parses blank, start-only, and start+end event times", () => {
    expect(parseEventTimes(null, null, null)).toEqual({ ok: true, startsAt: null, endsAt: null });
    expect(parseEventTimes("2027-03-13", "15:00", null)).toEqual({
      ok: true,
      startsAt: "2027-03-13T15:00",
      endsAt: null,
    });
    expect(parseEventTimes("2027-03-13", "15:00", "15:45")).toEqual({
      ok: true,
      startsAt: "2027-03-13T15:00",
      endsAt: "2027-03-13T15:45",
    });

    expect(parseEventTimes("2027-03-13", "15:00", "15:00").ok).toBe(false);
    // Ending before the start time means it runs past midnight.
    expect(parseEventTimes("2027-03-13", "18:00", "00:30")).toEqual({
      ok: true,
      startsAt: "2027-03-13T18:00",
      endsAt: "2027-03-14T00:30",
    });
    expect(parseEventTimes("2027-03-13", null, null).ok).toBe(false);
    expect(parseEventTimes(null, "15:00", null).ok).toBe(false);

    expect(splitWallTime("2027-03-13T15:30")).toEqual({ date: "2027-03-13", time: "15:30" });
    expect(splitWallTime(null)).toEqual({ date: "", time: "" });
  });

  it("builds UTC Google Calendar URLs and ICS files from wedding timezone wall times", () => {
    const wedding = { slug: "alex-and-sam", partnerOne: "Alex", partnerTwo: "Sam", timeZone: "Australia/Sydney" };
    // March 13 2027 is AEDT (UTC+11) in Sydney: 15:00 AEDT = 04:00 UTC, 15:45 AEDT = 04:45 UTC
    const event = {
      id: "ev1",
      name: "Ceremony",
      startsAt: "2027-03-13T15:00",
      endsAt: "2027-03-13T15:45",
      venueName: "Centennial Vineyards",
      address: "252 Centennial Rd, Bowral NSW 2576",
      dressCode: "Garden formal",
      description: "Please arrive by 2:45 pm.",
    };

    const gcal = new URL(buildGoogleCalendarUrl(wedding, event));
    expect(gcal.origin + gcal.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(gcal.searchParams.get("dates")).toBe("20270313T040000Z/20270313T044500Z");
    expect(gcal.searchParams.get("location")).toBe("Centennial Vineyards, 252 Centennial Rd, Bowral NSW 2576");
    expect(gcal.searchParams.get("details")).toContain("Dress code: Garden formal");

    const ics = buildEventIcs(wedding, event, Date.UTC(2027, 0, 1, 0, 0, 0));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("UID:ev1@alex-and-sam\r\n");
    expect(ics).toContain("DTSTART:20270313T040000Z\r\n");
    expect(ics).toContain("DTEND:20270313T044500Z\r\n");
    expect(ics).toContain("LOCATION:Centennial Vineyards\\, 252 Centennial Rd\\, Bowral NSW 2576\r\n");
    expect(ics).toContain("DESCRIPTION:Dress code: Garden formal\\n\\nPlease arrive by 2:45 pm.\r\n");

    const maps = buildGoogleMapsUrl("Centennial Vineyards", "252 Centennial Rd, Bowral NSW 2576");
    expect(maps).toBe(
      "https://www.google.com/maps/search/?api=1&query=Centennial%20Vineyards%2C%20252%20Centennial%20Rd%2C%20Bowral%20NSW%202576",
    );
  });
});
