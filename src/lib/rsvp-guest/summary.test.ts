import { describe, expect, it } from "vitest";
import { event, guest, household, question } from "@/lib/rsvp/fixtures";
import type { EventDetail } from "./form-model";
import {
  buildConfirmationSummary,
  collectRecipientEmails,
  formatConfirmationEmailBody,
  formatConfirmationEmailFooter,
} from "./summary";

const ceremony: EventDetail = {
  ...event("ceremony", { name: "Ceremony", position: 0 }),
  startsAt: "2027-03-13T15:00",
  endsAt: "2027-03-13T15:45",
  venueName: "Centennial Vineyards",
  address: null,
};
const reception: EventDetail = {
  ...event("reception", { name: "Reception", position: 1 }),
  startsAt: "2027-03-13T17:00",
  endsAt: "2027-03-13T23:00",
  venueName: "Centennial Vineyards",
  address: null,
};

const meal = question("meal", {
  label: "Main course",
  eventId: "reception",
  required: true,
  options: [
    { id: "beef", label: "Slow-cooked beef" },
    { id: "fish", label: "Barramundi" },
  ],
  position: 0,
});
const dietary = question("diet", {
  label: "Any dietary requirements?",
  eventId: "reception",
  options: [
    { id: "no", label: "No" },
    { id: "yes", label: "Yes" },
  ],
  position: 1,
});
const dietaryDetail = question("dietDetail", {
  label: "Tell us about them",
  type: "text",
  parentQuestionId: "diet",
  parentOptionId: "yes",
  position: 2,
});
const song = question("song", {
  label: "A song that will get you dancing",
  type: "text",
  scope: "household",
  position: 3,
});

const h = household("h1", { envelopeName: "The Jones Family", plusOnesAllowed: 1 });
const david = guest("david", "h1", { firstName: "David", lastName: "Jones", email: "david@example.com" });
const susan = guest("susan", "h1", { firstName: "Susan", lastName: "Jones", email: "SUSAN@example.com" });
const plus = guest("plus", "h1", { firstName: "Dev", lastName: "Patel", isPlusOne: true });

describe("buildConfirmationSummary & email formatting", () => {
  it("groups attendance, resolves option labels, omits hidden follow-ups, and formats plain-text email", () => {
    const summary = buildConfirmationSummary({
      household: h,
      guests: [david, susan, plus],
      events: [ceremony, reception],
      questions: [meal, dietary, dietaryDetail, song],
      responses: [
        { guestId: "david", eventId: "ceremony", attending: true },
        { guestId: "david", eventId: "reception", attending: true },
        { guestId: "susan", eventId: "ceremony", attending: true },
        { guestId: "susan", eventId: "reception", attending: false },
        { guestId: "plus", eventId: "ceremony", attending: true },
        { guestId: "plus", eventId: "reception", attending: true },
      ],
      answers: [
        { questionId: "meal", guestId: "david", householdId: null, value: "beef" },
        { questionId: "diet", guestId: "david", householdId: null, value: "yes" },
        { questionId: "dietDetail", guestId: "david", householdId: null, value: "Nut allergy" },
        // Susan declined reception so her stale meal answer should not show
        { questionId: "meal", guestId: "susan", householdId: null, value: "fish" },
        { questionId: "meal", guestId: "plus", householdId: null, value: "fish" },
        { questionId: "song", guestId: null, householdId: "h1", value: "September" },
      ],
      note: "Can't wait to celebrate!",
    });

    expect(summary.householdLabel).toBe("The Jones Family");
    expect(summary.anyAttending).toBe(true);
    expect(summary.events[0]?.attending.map((g) => g.name)).toEqual(["David Jones", "Susan Jones", "Dev Patel"]);
    expect(summary.events[1]?.attending.map((g) => g.name)).toEqual(["David Jones", "Dev Patel"]);
    expect(summary.events[1]?.declined.map((g) => g.name)).toEqual(["Susan Jones"]);
    expect(summary.plusOnes).toEqual([{ id: "plus", name: "Dev Patel" }]);
    expect(summary.guestAnswers).toEqual([
      {
        guestId: "david",
        guestName: "David Jones",
        ageGroup: "adult",
        isPlusOne: false,
        answers: [
          { questionId: "meal", label: "Main course", displayValue: "Slow-cooked beef" },
          { questionId: "diet", label: "Any dietary requirements?", displayValue: "Yes" },
          { questionId: "dietDetail", label: "Tell us about them", displayValue: "Nut allergy" },
        ],
      },
      {
        guestId: "plus",
        guestName: "Dev Patel",
        ageGroup: "adult",
        isPlusOne: true,
        answers: [{ questionId: "meal", label: "Main course", displayValue: "Barramundi" }],
      },
    ]);
    expect(summary.householdAnswers).toEqual([
      { questionId: "song", label: "A song that will get you dancing", displayValue: "September" },
    ]);
    expect(summary.note).toBe("Can't wait to celebrate!");

    const body = formatConfirmationEmailBody(summary, { partnerOne: "Alex", partnerTwo: "Sam" });
    expect(body).toContain("Hi The Jones Family,");
    expect(body).toContain("Slow-cooked beef");
    expect(body).toContain("Barramundi");
    expect(body).toContain("Nut allergy");
    expect(body).toContain("Additional guests: Dev Patel");
    expect(body).toContain("Can't wait to celebrate!");
    expect(body).toContain("Can't make it: Susan Jones");
  });

  it("handles all-declined summary and omits null wedding metadata from footer", () => {
    const summary = buildConfirmationSummary({
      household: household("h2", { envelopeName: null }),
      guests: [david],
      events: [ceremony],
      questions: [meal],
      responses: [{ guestId: "david", eventId: "ceremony", attending: false }],
      answers: [],
      note: null,
    });
    expect(summary.anyAttending).toBe(false);
    const body = formatConfirmationEmailBody(summary, { partnerOne: "Alex", partnerTwo: "Sam" });
    expect(body).toContain("sorry you won't be able to make it");
    expect(body).not.toContain("Note to the couple");

    expect(
      formatConfirmationEmailFooter({
        partnerOne: "Alex",
        partnerTwo: "Sam",
        date: "2027-03-13",
        locationName: "Bowral, NSW",
      }),
    ).toBe("Alex & Sam · Saturday 13 March 2027 · Bowral, NSW");

    expect(
      formatConfirmationEmailFooter({
        partnerOne: "Alex",
        partnerTwo: "Sam",
        date: null,
        locationName: null,
      }),
    ).toBe("Alex & Sam");
  });

  it("collects unique non-empty recipient emails case-insensitively", () => {
    expect(
      collectRecipientEmails([
        { email: " david@example.com " },
        { email: null },
        { email: "" },
        { email: "DAVID@example.com" },
        { email: "susan@example.com" },
      ]),
    ).toEqual(["david@example.com", "susan@example.com"]);
  });
});
