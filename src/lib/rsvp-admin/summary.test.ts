import { describe, expect, it } from "vitest";
import { event, guest, household } from "@/lib/rsvp/fixtures";
import type { WeddingSnapshot } from "@/lib/stats";
import {
  countDeclinedAllInvited,
  describeActivityAction,
  describeDeadlineLine,
  describeRsvpWindowStatus,
  formatInstantInZone,
  getPendingHouseholds,
} from "./summary";

describe("countDeclinedAllInvited & getPendingHouseholds", () => {
  const ceremony = event("ceremony", { name: "Ceremony", position: 0 });
  const reception = event("reception", { name: "Reception", position: 1 });
  const rehearsal = event("rehearsal", {
    name: "Rehearsal dinner",
    position: 2,
    audience: { mode: "tags", tagIds: ["family"] },
  });

  const snapshot: WeddingSnapshot = {
    households: [
      household("h1", { envelopeName: "The Jones Family" }),
      household("h2"),
      household("h3"),
      household("h4"),
    ],
    guests: [
      // h1: declined everything
      guest("ellie", "h1", { firstName: "Ellie", lastName: "Jones" }),
      // h2: mixed (attending ceremony, declined reception) -> NOT declined-all
      guest("sam", "h2", { firstName: "Sam", lastName: "Lee" }),
      // h3: partial (david replied, susan pending)
      guest("david", "h3", { firstName: "David", lastName: "Smith", tagIds: ["family"] }),
      guest("susan", "h3", { firstName: "Susan", lastName: "Smith" }),
      // h4: not_started
      guest("tom", "h4", { firstName: "Tom", lastName: "Nguyen" }),
    ],
    events: [ceremony, reception, rehearsal],
    questions: [],
    responses: [
      { guestId: "ellie", eventId: "ceremony", attending: false },
      { guestId: "ellie", eventId: "reception", attending: false },
      { guestId: "sam", eventId: "ceremony", attending: true },
      { guestId: "sam", eventId: "reception", attending: false },
      { guestId: "david", eventId: "ceremony", attending: true },
      { guestId: "david", eventId: "reception", attending: true },
      { guestId: "david", eventId: "rehearsal", attending: true },
    ],
    answers: [],
  };

  it("counts only guests who declined every RSVP event they were invited to", () => {
    expect(countDeclinedAllInvited(snapshot)).toBe(1);
  });

  it("lists pending households sorted partial-first with clear missing descriptions", () => {
    const pending = getPendingHouseholds(snapshot);
    expect(pending).toEqual([
      {
        householdId: "h3",
        label: "David & Susan Smith",
        state: "partial",
        missingSummary: "Waiting on Susan (Ceremony, Reception)",
      },
      {
        householdId: "h4",
        label: "Tom Nguyen",
        state: "not_started",
        missingSummary: "Hasn't replied yet · Ceremony, Reception",
      },
    ]);
  });
});

describe("describeDeadlineLine & describeRsvpWindowStatus", () => {
  const settings = {
    timeZone: "Australia/Sydney",
    rsvpOpen: true,
    rsvpDeadline: "2027-01-31",
    rsvpAllowEdits: true,
  };

  it("describes an open window with a deadline in Sydney time", () => {
    const now = Date.parse("2027-01-21T02:00:00Z"); // 21 Jan 2027 in Sydney -> 10 days left
    expect(describeDeadlineLine(settings, now)).toEqual({
      open: true,
      headline: "RSVPs close on Sunday 31 January 2027",
      detail: "10 days left",
      noDeadline: false,
    });
    expect(describeRsvpWindowStatus(settings, now)).toEqual({
      open: true,
      headline: "Guests can RSVP until 11:59 pm on Sunday 31 January 2027 (Australia/Sydney time).",
      detail: "Guests who have already replied can update their RSVP.",
    });
  });

  it("describes no deadline set", () => {
    const noDeadline = { ...settings, rsvpDeadline: null };
    expect(describeDeadlineLine(noDeadline)).toMatchObject({
      open: true,
      headline: "No deadline set",
      noDeadline: true,
    });
    expect(describeRsvpWindowStatus(noDeadline).headline).toBe(
      "Guests can RSVP now. No deadline is set.",
    );
  });

  it("describes closed by host and deadline passed", () => {
    expect(describeDeadlineLine({ ...settings, rsvpOpen: false })).toMatchObject({
      open: false,
      headline: "RSVPs are closed",
    });

    const afterDeadline = Date.parse("2027-02-01T00:00:00Z");
    expect(describeDeadlineLine(settings, afterDeadline)).toMatchObject({
      open: false,
      headline: "RSVPs are closed",
      detail: "Deadline passed on Sunday 31 January 2027",
    });
    expect(describeRsvpWindowStatus(settings, afterDeadline).open).toBe(false);
  });
});

describe("formatInstantInZone & describeActivityAction", () => {
  it("formats UTC instants in Australia/Sydney", () => {
    // 2027-01-15T04:30:00Z is 3:30 pm AEDT (UTC+11)
    expect(formatInstantInZone(Date.parse("2027-01-15T04:30:00Z"), "Australia/Sydney")).toBe(
      "15 Jan 2027, 3:30 pm",
    );
  });

  it("maps activity source and kind to exact copy", () => {
    expect(describeActivityAction("guest", "first")).toBe("replied for the first time");
    expect(describeActivityAction("guest", "update")).toBe("updated their RSVP");
    expect(describeActivityAction("host", "update")).toBe("RSVP changed by a host");
    expect(describeActivityAction("host", "first")).toBe("RSVP changed by a host");
  });
});
