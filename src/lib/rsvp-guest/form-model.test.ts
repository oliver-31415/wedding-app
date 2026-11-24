import { describe, expect, it } from "vitest";
import { event, guest, question } from "@/lib/rsvp/fixtures";
import { rsvpEventsFor, visibleQuestions } from "@/lib/rsvp/model";
import {
  buildDraft,
  buildInitialFormState,
  buildVirtualGuests,
  displayGuestName,
  errorDomId,
  firstErrorKey,
  nextPlusOneTempId,
  orderedFormErrorKeys,
  pruneGuestFromFormState,
  toSubmissionInput,
} from "./form-model";

const rehearsal = event("rehearsal", { position: 0, audience: { mode: "tags", tagIds: ["family"] } });
const ceremony = event("ceremony", { position: 1 });
const reception = event("reception", { position: 2 });
const events = [rehearsal, ceremony, reception];

const meal = question("meal", {
  eventId: "reception",
  required: true,
  options: [
    { id: "beef", label: "Slow-cooked beef" },
    { id: "fish", label: "Barramundi" },
  ],
  position: 0,
});
const song = question("song", { type: "text", scope: "household", position: 1 });

const priya = guest("priya", "h1", { firstName: "Priya", lastName: "Natarajan", tagIds: ["family"] });
const dev = guest("dev", "h1", { firstName: "Dev", lastName: "Patel", isPlusOne: true });

describe("form-model", () => {
  it("pre-fills existing plus-ones, attendance, answers, and note", () => {
    const state = buildInitialFormState(
      [priya, dev],
      [
        { guestId: "priya", eventId: "ceremony", attending: true },
        { guestId: "dev", eventId: "ceremony", attending: false },
      ],
      [
        { questionId: "meal", guestId: "priya", householdId: null, value: "beef" },
        { questionId: "song", guestId: null, householdId: "h1", value: "Dancing Queen" },
      ],
      "So excited!",
    );

    expect(state.plusOnes).toEqual([{ id: "dev", firstName: "Dev", lastName: "Patel" }]);
    expect(state.attendance).toEqual({ "priya:ceremony": true, "dev:ceremony": false });
    expect(state.answers).toEqual({ "meal:priya": "beef", "song:household": "Dancing Queen" });
    expect(state.note).toBe("So excited!");
  });

  it("gives newly added plus-ones temp ids and inherits household invitations and questions", () => {
    const id1 = nextPlusOneTempId([]);
    const id2 = nextPlusOneTempId([{ id: id1 }]);
    expect(id1).toBe("new-1");
    expect(id2).toBe("new-2");

    const virtual = buildVirtualGuests([priya], [{ id: id1, firstName: "Alex", lastName: "Chen" }], "h1");
    expect(virtual).toHaveLength(2);
    const plusGuest = virtual[1]!;
    // Priya has tag "family", so the new plus-one is also invited to the rehearsal dinner.
    expect(rsvpEventsFor(plusGuest, events, virtual).map((e) => e.id)).toEqual(["rehearsal", "ceremony", "reception"]);

    const draft = buildDraft({ [`${id1}:reception`]: true }, {});
    const vis = visibleQuestions([meal, song], virtual, events, draft);
    expect(vis.perGuest[1]?.questions.map((q) => q.id)).toEqual(["meal"]);
  });

  it("converts form state into SubmissionInput and prunes removed plus-ones cleanly", () => {
    const state = {
      plusOnes: [{ id: "new-1", firstName: "Alex", lastName: "Chen" }],
      attendance: { "priya:ceremony": true, "new-1:ceremony": true },
      answers: { "meal:priya": "beef", "meal:new-1": "fish", "song:household": "Mr Brightside" },
      note: "  See you there!  ",
    };

    const sub = toSubmissionInput(state);
    expect(sub).toEqual({
      plusOnes: [{ id: "new-1", firstName: "Alex", lastName: "Chen" }],
      attendance: [
        { guestId: "priya", eventId: "ceremony", attending: true },
        { guestId: "new-1", eventId: "ceremony", attending: true },
      ],
      answers: [
        { questionId: "meal", guestId: "priya", value: "beef" },
        { questionId: "meal", guestId: "new-1", value: "fish" },
        { questionId: "song", guestId: null, value: "Mr Brightside" },
      ],
      note: "See you there!",
    });

    const pruned = pruneGuestFromFormState(state, "new-1");
    expect(pruned.plusOnes).toEqual([]);
    expect(pruned.attendance).toEqual({ "priya:ceremony": true });
    expect(pruned.answers).toEqual({ "meal:priya": "beef", "song:household": "Mr Brightside" });
  });

  it("maps error keys to DOM ids and picks the first error in visual document order", () => {
    expect(errorDomId("plusOnes")).toBe("rsvp-field-plusOnes");
    expect(errorDomId("plusOne.0")).toBe("rsvp-field-plusOne-0");
    expect(errorDomId("attendance.priya.ceremony")).toBe("rsvp-field-attendance-priya-ceremony");
    expect(errorDomId("answer.meal.priya")).toBe("rsvp-field-answer-meal-priya");
    expect(errorDomId("answer.song.household")).toBe("rsvp-field-answer-song-household");
    expect(errorDomId("note")).toBe("rsvp-field-note");

    const draft = buildDraft({ "priya:reception": true }, {});
    const ordered = orderedFormErrorKeys({
      plusOnesCount: 1,
      virtualGuests: [priya],
      events,
      questions: [meal, song],
      draft,
    });

    const errors = {
      note: "Too long",
      "answer.meal.priya": "Required",
      "attendance.priya.ceremony": "Missing",
    };
    expect(firstErrorKey(errors, ordered)).toBe("attendance.priya.ceremony");
    expect(firstErrorKey({ "plusOne.0": "Missing name", ...errors }, ordered)).toBe("plusOne.0");
  });

  it("formats fallback display name for unnamed plus-ones", () => {
    expect(displayGuestName({ firstName: "", lastName: "", isPlusOne: true }, 0)).toBe("Additional guest 1");
    expect(displayGuestName({ firstName: "Dev", lastName: "Patel", isPlusOne: true }, 0)).toBe("Dev Patel");
  });
});
