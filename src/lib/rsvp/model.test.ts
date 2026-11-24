import { describe, expect, it } from "vitest";
import {
  chainDepth,
  chainOrder,
  householdLabel,
  householdRsvpState,
  responsesMap,
  rsvpEventsFor,
  rsvpWindow,
  validateSubmission,
  type SubmissionInput,
} from "./model";
import { event, guest, household, question } from "./fixtures";

const ceremony = event("ceremony", { position: 0 });
const rehearsal = event("rehearsal", { position: 1, audience: { mode: "tags", tagIds: ["family"] } });
const reception = event("reception", { position: 2 });
const meal = question("meal", {
  eventId: "reception",
  required: true,
  options: [
    { id: "beef", label: "Beef" },
    { id: "fish", label: "Fish" },
  ],
});
const allergies = question("allergies", { type: "text" });
const dietYes = question("diet", {
  options: [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
  ],
  position: 1,
});
const dietDetail = question("dietDetail", { type: "text", parentQuestionId: "diet", parentOptionId: "yes", required: true, position: 2 });
const song = question("song", { type: "text", scope: "household", eventId: "reception", required: true });

const david = guest("david", "h1", { tagIds: ["family"] });
const susan = guest("susan", "h1");
const events = [ceremony, rehearsal, reception];

function input(over: Partial<SubmissionInput> = {}): SubmissionInput {
  return { attendance: [], answers: [], plusOnes: [], note: null, ...over };
}
const all = (guestIds: string[], eventIds: string[], attending = true) =>
  guestIds.flatMap((guestId) => eventIds.map((eventId) => ({ guestId, eventId, attending })));

describe("invitations", () => {
  it("only invites tagged guests to tag-restricted events", () => {
    expect(rsvpEventsFor(david, events, [david, susan]).map((e) => e.id)).toEqual(["ceremony", "rehearsal", "reception"]);
    expect(rsvpEventsFor(susan, events, [david, susan]).map((e) => e.id)).toEqual(["ceremony", "reception"]);
  });

  it("invites plus-ones to whatever the household's named guests are invited to", () => {
    const plus = guest("plus", "h1", { isPlusOne: true });
    expect(rsvpEventsFor(plus, events, [david, plus]).map((e) => e.id)).toContain("rehearsal");
    expect(rsvpEventsFor(plus, events, [susan, plus]).map((e) => e.id)).not.toContain("rehearsal");
  });

  it("skips events that don't collect RSVPs", () => {
    expect(rsvpEventsFor(susan, [event("brunch", { rsvpEnabled: false })], [susan])).toEqual([]);
  });
});

describe("validateSubmission (guest)", () => {
  const ctx = {
    household: household("h1", { plusOnesAllowed: 1 }),
    guests: [david, susan],
    events,
    questions: [meal, allergies, dietYes, dietDetail, song],
    mode: "guest" as const,
  };

  it("requires an answer for every invited guest and event", () => {
    const r = validateSubmission(input({ attendance: all(["david"], ["ceremony"]) }), ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors)).toEqual(
      expect.arrayContaining(["attendance.david.rehearsal", "attendance.susan.ceremony", "attendance.susan.reception"]),
    );
    expect(r.errors["attendance.susan.rehearsal"]).toBeUndefined();
  });

  it("asks meal only of guests attending the reception, and requires it", () => {
    const attendance = [...all(["david"], ["ceremony", "rehearsal", "reception"]), ...all(["susan"], ["ceremony", "reception"], false)];
    const r = validateSubmission(input({ attendance, answers: [{ questionId: "song", guestId: null, value: "Abba" }] }), ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors["answer.meal.david"]).toBeDefined();
    expect(r.errors["answer.meal.susan"]).toBeUndefined();
  });

  it("drops answers that no longer apply (meal for a guest who declined)", () => {
    const attendance = [...all(["david"], ["ceremony", "rehearsal", "reception"]), ...all(["susan"], ["ceremony", "reception"], false)];
    const r = validateSubmission(
      input({
        attendance,
        answers: [
          { questionId: "meal", guestId: "david", value: "beef" },
          { questionId: "meal", guestId: "susan", value: "fish" },
          { questionId: "song", guestId: null, value: "Abba" },
        ],
      }),
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.answers).toEqual([
      { questionId: "song", guestId: null, value: "Abba" },
      { questionId: "meal", guestId: "david", value: "beef" },
    ]);
  });

  it("rejects a choice that isn't one of the options", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"]).concat(all(["susan"], ["ceremony", "reception"]));
    const r = validateSubmission(input({ attendance, answers: [{ questionId: "meal", guestId: "david", value: "pizza" }] }), ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors["answer.meal.david"]).toBe("Choose one of the options.");
  });

  it("shows follow-ups only for the trigger answer", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal"], true)
      .concat([{ guestId: "david", eventId: "reception", attending: false }])
      .concat(all(["susan"], ["ceremony", "reception"], false));
    const base = { attendance };
    const yes = validateSubmission(input({ ...base, answers: [{ questionId: "diet", guestId: "david", value: "yes" }] }), ctx);
    expect(yes.ok).toBe(false);
    if (!yes.ok) expect(yes.errors["answer.dietDetail.david"]).toBeDefined();

    const no = validateSubmission(
      input({
        ...base,
        answers: [
          { questionId: "diet", guestId: "david", value: "no" },
          { questionId: "dietDetail", guestId: "david", value: "stale text" },
        ],
      }),
      ctx,
    );
    expect(no.ok).toBe(true);
    if (no.ok) expect(no.value.answers.find((a) => a.questionId === "dietDetail")).toBeUndefined();
  });

  it("asks household questions once when anyone is attending the event", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal"], true)
      .concat([{ guestId: "david", eventId: "reception", attending: false }])
      .concat(all(["susan"], ["ceremony", "reception"], false));
    const r = validateSubmission(input({ attendance }), ctx);
    expect(r.ok).toBe(true); // nobody at the reception → no song question
  });

  it("enforces the plus-one allowance and requires names", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false).concat(all(["susan"], ["ceremony", "reception"], false));
    const tooMany = validateSubmission(
      input({
        attendance,
        plusOnes: [
          { id: "new-1", firstName: "Ann", lastName: "Lee" },
          { id: "new-2", firstName: "Bo", lastName: "Lee" },
        ],
      }),
      ctx,
    );
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.errors.plusOnes).toMatch(/up to 1 extra guest/);

    const unnamed = validateSubmission(input({ attendance, plusOnes: [{ id: "new-1", firstName: "Ann", lastName: "" }] }), ctx);
    expect(unnamed.ok).toBe(false);
  });

  it("requires plus-ones to answer too, and invites them like the household", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false).concat(all(["susan"], ["ceremony", "reception"], false));
    const r = validateSubmission(input({ attendance, plusOnes: [{ id: "new-1", firstName: "Ann", lastName: "Lee" }] }), ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors)).toEqual(
      expect.arrayContaining(["attendance.new-1.ceremony", "attendance.new-1.rehearsal", "attendance.new-1.reception"]),
    );
  });

  it("removes existing plus-ones left out of the list", () => {
    const plus = guest("plus", "h1", { isPlusOne: true });
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false).concat(all(["susan"], ["ceremony", "reception"], false));
    const r = validateSubmission(input({ attendance }), { ...ctx, guests: [david, susan, plus] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.plusOnes.remove).toEqual(["plus"]);
  });

  it("ignores attendance for events the guest isn't invited to", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false).concat(all(["susan"], ["ceremony", "rehearsal", "reception"], false));
    const r = validateSubmission(input({ attendance }), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.attendance.find((a) => a.guestId === "susan" && a.eventId === "rehearsal")).toBeUndefined();
  });
});

describe("general questions and plus-ones", () => {
  const ctx = {
    household: household("h1", { plusOnesAllowed: 1 }),
    guests: [david, susan],
    events,
    questions: [dietYes, dietDetail],
    mode: "guest" as const,
  };

  it("doesn't ask general questions of guests who can't come to anything", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false).concat(all(["susan"], ["ceremony", "reception"], false));
    const r = validateSubmission(input({ attendance, answers: [{ questionId: "diet", guestId: "david", value: "yes" }] }), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers).toEqual([]);
  });

  it("only lets a plus-one come with someone from the invitation", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false)
      .concat(all(["susan"], ["ceremony", "reception"], false))
      .concat(all(["new-1"], ["ceremony", "rehearsal", "reception"], true));
    const r = validateSubmission(input({ attendance, plusOnes: [{ id: "new-1", firstName: "Ann", lastName: "Lee" }] }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["attendance.new-1.ceremony"]).toMatch(/come along with someone/);
  });

  it("rejects made-up plus-one ids", () => {
    const attendance = all(["david"], ["ceremony", "rehearsal", "reception"], false).concat(all(["susan"], ["ceremony", "reception"], false));
    const r = validateSubmission(input({ attendance, plusOnes: [{ id: "household", firstName: "Ann", lastName: "Lee" }] }), ctx);
    expect(r.ok).toBe(false);
  });
});

describe("validateSubmission (host)", () => {
  it("lets the couple save partial answers", () => {
    const r = validateSubmission(input({ attendance: [{ guestId: "susan", eventId: "ceremony", attending: true }] }), {
      household: household("h1"),
      guests: [david, susan],
      events,
      questions: [meal],
      mode: "host",
    });
    expect(r.ok).toBe(true);
  });
});

describe("household state", () => {
  it("tracks not started → partial → complete", () => {
    const members = [david, susan];
    expect(householdRsvpState(members, events, responsesMap([]))).toBe("not_started");
    const some = all(["david"], ["ceremony", "rehearsal", "reception"]);
    expect(householdRsvpState(members, events, responsesMap(some))).toBe("partial");
    const every = some.concat(all(["susan"], ["ceremony", "reception"]));
    expect(householdRsvpState(members, events, responsesMap(every))).toBe("complete");
    expect(householdRsvpState(members, [event("x", { rsvpEnabled: false })], responsesMap([]))).toBe("none");
  });
});

describe("rsvpWindow", () => {
  const base = { timeZone: "Australia/Sydney", rsvpOpen: true, rsvpDeadline: "2027-01-31", rsvpAllowEdits: true };
  it("closes at the end of the deadline day in the wedding's time zone", () => {
    expect(rsvpWindow(base, Date.parse("2027-01-31T12:59:00Z")).open).toBe(true); // 11:59 pm AEDT
    expect(rsvpWindow(base, Date.parse("2027-01-31T13:00:00Z")).open).toBe(false); // midnight AEDT
  });
  it("can be closed by the host", () => {
    expect(rsvpWindow({ ...base, rsvpOpen: false })).toEqual({ open: false, reason: "closed_by_host" });
  });
});

describe("householdLabel", () => {
  it("prefers the envelope name, then joins first names sharing a surname", () => {
    expect(householdLabel({ envelopeName: "The Joneses" }, [david])).toBe("The Joneses");
    expect(householdLabel({ envelopeName: null }, [david, susan])).toBe("David & Susan Jones");
    expect(householdLabel({ envelopeName: null }, [david, guest("amy", "h1", { lastName: "Lee" })])).toBe("David Jones & Amy Lee");
  });
});

describe("chainOrder", () => {
  const q = (id: string, position: number, parentQuestionId: string | null = null) => ({ id, position, parentQuestionId });
  it("puts each follow-up straight after its question, siblings by position", () => {
    const order = chainOrder([
      q("song", 2),
      q("details", 0, "diet"),
      q("meal", 0),
      q("diet", 1),
      q("severity", 1, "details"),
      q("other", 2, "diet"),
    ]);
    expect(order.map((x) => x.id)).toEqual(["meal", "diet", "details", "severity", "other", "song"]);
  });

  it("treats a follow-up whose question is missing as top level", () => {
    expect(chainOrder([q("b", 1), q("orphan", 0, "gone")]).map((x) => x.id)).toEqual(["orphan", "b"]);
  });

  it("measures depth", () => {
    const qs = [q("a", 0), q("b", 0, "a"), q("c", 0, "b")];
    expect(qs.map((x) => chainDepth(x, qs))).toEqual([0, 1, 2]);
  });
});
