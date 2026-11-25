import { describe, expect, it } from "vitest";
import { computeStats } from "@/lib/stats";
import {
  describeDietary,
  dietaryGroup,
  editDietary,
  encodeDietary,
  NO_DIETARY_NEEDS,
  parseDietary,
} from "./dietary";
import { event, guest, household, question } from "./fixtures";
import { answerLabel, usableAnswers, validateSubmission } from "./model";

describe("dietary values", () => {
  it("parses, sorts and de-duplicates needs, and tidies the note", () => {
    expect(parseDietary('{"needs":["gluten_free","vegan","vegan"],"note":"  coeliac "}')).toEqual({
      needs: ["vegan", "gluten_free"],
      note: "coeliac",
    });
    expect(parseDietary('{"needs":[]}')).toEqual({ needs: [], note: null });
  });

  it("never turns a blank note into \"no requirements\"", () => {
    expect(parseDietary('{"needs":[],"note":"  "}')).toBeNull();
    expect(editDietary("", { note: " " })).toBe("");
  });

  it("rejects anything that isn't a dietary answer", () => {
    for (const raw of ["", "vegan", "[]", '{"needs":["paleo"]}', '{"needs":"vegan"}', '{"needs":[],"note":3}']) {
      expect(parseDietary(raw)).toBeNull();
    }
  });

  it("describes answers for summaries and exports", () => {
    expect(describeDietary({ needs: [], note: null })).toBe("None");
    expect(describeDietary({ needs: ["vegetarian", "gluten_free"], note: "no mushrooms" })).toBe(
      "Vegetarian, gluten free (no mushrooms)",
    );
    expect(describeDietary({ needs: [], note: "low FODMAP" })).toBe("low FODMAP");
  });

  it("groups people by their exact combination", () => {
    expect(dietaryGroup({ needs: [], note: null })).toEqual({ key: "none", label: "No requirements" });
    expect(dietaryGroup({ needs: [], note: "x" }).key).toBe("other");
    expect(dietaryGroup({ needs: ["vegan", "gluten_free"], note: null })).toEqual({
      key: "vegan+gluten_free",
      label: "Vegan + gluten free",
    });
  });

  it("edits like a checklist: none clears the rest, ticking clears none, empty is unanswered", () => {
    let v = editDietary("", { need: "vegan", on: true });
    expect(parseDietary(v)?.needs).toEqual(["vegan"]);
    v = editDietary(v, { none: true });
    expect(v).toBe(NO_DIETARY_NEEDS);
    v = editDietary(v, { need: "halal", on: true });
    expect(parseDietary(v)?.needs).toEqual(["halal"]);
    v = editDietary(v, { need: "halal", on: false });
    expect(v).toBe("");
    expect(editDietary(NO_DIETARY_NEEDS, { none: false })).toBe("");
    // Spaces survive while typing a note.
    expect(parseDietary(editDietary("", { note: "no " }), { keepSpaces: true })?.note).toBe("no ");
  });
});

describe("dietary questions in an RSVP", () => {
  const h = household("h1");
  const guests = [guest("ann", "h1"), guest("bob", "h1")];
  const events = [event("reception")];
  const dietary = question("diet", { type: "dietary", label: "Any dietary requirements?", required: true });
  const ctx = { household: h, guests, events, questions: [dietary], mode: "guest" as const };
  const attendance = [
    { guestId: "ann", eventId: "reception", attending: true },
    { guestId: "bob", eventId: "reception", attending: false },
  ];

  it("stores the canonical value and only asks people who are coming", () => {
    const r = validateSubmission(
      {
        attendance,
        answers: [
          { questionId: "diet", guestId: "ann", value: '{"needs":["gluten_free","vegan"],"note":" coeliac "}' },
          { questionId: "diet", guestId: "bob", value: NO_DIETARY_NEEDS },
        ],
        plusOnes: [],
        note: null,
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.answers).toEqual([
      { questionId: "diet", guestId: "ann", value: encodeDietary({ needs: ["vegan", "gluten_free"], note: "coeliac" }) },
    ]);
  });

  it("requires an answer (none counts) and rejects made-up values", () => {
    const missing = validateSubmission({ attendance, answers: [], plusOnes: [], note: null }, ctx);
    expect(missing.ok).toBe(false);
    const bad = validateSubmission(
      { attendance, answers: [{ questionId: "diet", guestId: "ann", value: "vegan" }], plusOnes: [], note: null },
      ctx,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors["answer.diet.ann"]).toMatch(/Tick what applies/);
  });

  it("shows readable answers and drops unreadable ones", () => {
    expect(answerLabel(dietary, NO_DIETARY_NEEDS)).toBe("None");
    expect(usableAnswers([{ questionId: "diet", value: "garbage" }], [dietary])).toEqual([]);
  });

  it("counts everyone asked, by exact combination and by need", () => {
    const people = [guest("ann", "h1"), guest("bob", "h1"), guest("cat", "h2"), guest("dan", "h2")];
    const stats = computeStats({
      households: [household("h1"), household("h2")],
      guests: people,
      events,
      questions: [dietary],
      responses: people.map((g) => ({ guestId: g.id, eventId: "reception", attending: g.id !== "dan" })),
      answers: [
        { questionId: "diet", guestId: "ann", householdId: null, value: '{"needs":["vegan","gluten_free"]}' },
        { questionId: "diet", guestId: "bob", householdId: null, value: NO_DIETARY_NEEDS },
        { questionId: "diet", guestId: "dan", householdId: null, value: '{"needs":["vegan"]}' },
      ],
    });
    const d = stats.questions[0].dietary!;
    // Dan isn't coming, so isn't asked; Cat is coming but hasn't answered.
    expect(d.people.map((p) => [p.who, p.answer ? describeDietary(p.answer) : null])).toEqual([
      ["Ann Jones", "Vegan, gluten free"],
      ["Bob Jones", "None"],
      ["Cat Jones", null],
    ]);
    expect(stats.questions[0]).toMatchObject({ asked: 3, answered: 2 });
    expect(d.withNeeds).toBe(1);
    expect(d.groups.map((g) => [g.label, g.count])).toEqual([
      ["Vegan + gluten free", 1],
      ["No requirements", 1],
    ]);
    expect(d.needs.map((n) => [n.label, n.count])).toEqual([
      ["Vegan", 1],
      ["Gluten free", 1],
    ]);
  });
});
