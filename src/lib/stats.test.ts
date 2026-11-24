import { describe, expect, it } from "vitest";
import { computeStats, pct } from "./stats";
import { event, guest, household, question } from "./rsvp/fixtures";

describe("computeStats", () => {
  const snapshot = {
    households: [household("h1", { plusOnesAllowed: 1 }), household("h2"), household("h3")],
    guests: [
      guest("david", "h1", { tagIds: ["family"] }),
      guest("susan", "h1"),
      guest("kid", "h1", { ageGroup: "child" as const, email: null }),
      guest("amy", "h2"),
      guest("bob", "h3"),
    ],
    events: [
      event("ceremony", { position: 0 }),
      event("rehearsal", { position: 1, audience: { mode: "tags" as const, tagIds: ["family"] } }),
    ],
    questions: [
      question("meal", {
        eventId: "ceremony",
        options: [
          { id: "beef", label: "Beef" },
          { id: "fish", label: "Fish" },
        ],
      }),
    ],
    responses: [
      { guestId: "david", eventId: "ceremony", attending: true },
      { guestId: "david", eventId: "rehearsal", attending: true },
      { guestId: "susan", eventId: "ceremony", attending: true },
      { guestId: "kid", eventId: "ceremony", attending: true },
      { guestId: "amy", eventId: "ceremony", attending: false },
    ],
    answers: [
      { questionId: "meal", guestId: "david", householdId: null, value: "beef" },
      { questionId: "meal", guestId: "susan", householdId: null, value: "fish" },
      // Stale answer from someone who has since declined — must not be counted.
      { questionId: "meal", guestId: "amy", householdId: null, value: "beef" },
    ],
  };
  const stats = computeStats(snapshot);

  it("counts households by RSVP state", () => {
    expect(stats.households).toEqual({ total: 3, not_started: 1, partial: 0, complete: 2, none: 0 });
    expect(stats.responseRate).toEqual({ n: 2, of: 3 });
    expect(pct(stats.responseRate)).toBe(67);
  });

  it("counts each event's invited, attending, declined and pending guests", () => {
    const [ceremony, rehearsal] = stats.events;
    // h1's plus-one spot isn't "open": everyone there has already replied.
    expect(ceremony).toMatchObject({ invited: 5, attending: 3, attendingAdults: 2, attendingChildren: 1, declined: 1, pending: 1, openPlusOnes: 0 });
    expect(rehearsal).toMatchObject({ invited: 1, attending: 1, pending: 0 });
  });

  it("counts answers only where the question applies", () => {
    const meal = stats.questions[0];
    expect(meal.asked).toBe(3); // david, susan, kid attending the ceremony
    expect(meal.answered).toBe(2);
    expect(meal.options.map((o) => o.count)).toEqual([1, 1]);
  });

  it("summarises guests", () => {
    // The child without an email isn't flagged — only adults are.
    expect(stats.guests).toEqual({ total: 5, adults: 4, children: 1, plusOnes: 0, withoutEmail: 0, householdsWithoutEmail: 0 });
    expect(stats.attendingAnything).toBe(3);
    expect(stats.plusOneSpots).toEqual({ allowed: 1, named: 0, open: 0 });
  });

  it("counts answers to options the couple has since removed", () => {
    const removed = computeStats({
      ...snapshot,
      answers: [{ questionId: "meal", guestId: "david", householdId: null, value: "lamb" }],
    });
    expect(removed.questions[0]).toMatchObject({ answered: 1, removedOptionAnswers: 1 });
  });

  it("ignores attendance at events a guest is no longer invited to", () => {
    const untagged = computeStats({
      ...snapshot,
      guests: snapshot.guests.map((g) => (g.id === "david" ? { ...g, tagIds: [] } : g)),
    });
    expect(untagged.events[1]).toMatchObject({ invited: 0, attending: 0 });
  });
});
