import { describe, expect, it } from "vitest";
import {
  eligibleParentQuestions,
  isValidIsoDate,
  parseOptionsJson,
  validateQuestionInput,
  validateRsvpSettingsInput,
  wouldCreateCycle,
  type ExistingQuestionRef,
} from "./validation";

function makeQuestion(
  id: string,
  over: Partial<ExistingQuestionRef> = {},
): ExistingQuestionRef {
  return {
    id,
    type: "choice",
    label: `Question ${id}`,
    options: [
      { id: `${id}-yes`, label: "Yes" },
      { id: `${id}-no`, label: "No" },
    ],
    scope: "guest",
    eventId: null,
    parentQuestionId: null,
    parentOptionId: null,
    archived: false,
    position: 0,
    ...over,
  };
}

let seq = 0;
const nextId = () => `gen-${++seq}`;

describe("cycle detection and eligible parents", () => {
  const q1 = makeQuestion("q1", { position: 0 });
  const q2 = makeQuestion("q2", { parentQuestionId: "q1", parentOptionId: "q1-yes", position: 1 });
  const q3 = makeQuestion("q3", { parentQuestionId: "q2", parentOptionId: "q2-yes", position: 2 });
  const qHouse = makeQuestion("qh", { scope: "household", position: 3 });
  const qText = makeQuestion("qt", { type: "text", options: [], position: 4 });
  const qArchived = makeQuestion("qa", { archived: true, position: 5 });
  const all = [q1, q2, q3, qHouse, qText, qArchived];

  it("detects self-reference and indirect cycles", () => {
    expect(wouldCreateCycle("q1", "q1", all)).toBe(true);
    expect(wouldCreateCycle("q1", "q2", all)).toBe(true);
    expect(wouldCreateCycle("q1", "q3", all)).toBe(true);
    expect(wouldCreateCycle("q2", "q3", all)).toBe(true);
    expect(wouldCreateCycle("q3", "q1", all)).toBe(false);
    expect(wouldCreateCycle(null, "q1", all)).toBe(false);
  });

  it("filters eligible parents by scope, type, archived status, and descendants", () => {
    expect(eligibleParentQuestions(all, { editingId: "q1", scope: "guest" })).toEqual([]);
    expect(eligibleParentQuestions(all, { editingId: "q2", scope: "guest" }).map((q) => q.id)).toEqual(["q1"]);
    expect(eligibleParentQuestions(all, { editingId: null, scope: "guest" }).map((q) => q.id)).toEqual([
      "q1",
      "q2",
      "q3",
    ]);
    expect(eligibleParentQuestions(all, { editingId: null, scope: "household" }).map((q) => q.id)).toEqual(["qh"]);
  });
});

describe("validateQuestionInput", () => {
  const events = [
    { id: "ev-rec", name: "Reception", rsvpEnabled: true },
    { id: "ev-off", name: "Brunch", rsvpEnabled: false },
  ];
  const validTagIds = new Set(["tag-fam", "tag-wp"]);
  const baseCtx = {
    editing: null as ExistingQuestionRef | null,
    allQuestions: [] as ExistingQuestionRef[],
    events,
    validTagIds,
    answeredOptionIds: new Set<string>(),
    answerCount: 0,
    childQuestions: [] as ExistingQuestionRef[],
    generateOptionId: nextId,
  };

  it("creates a valid multiple-choice question with generated option IDs", () => {
    seq = 0;
    const res = validateQuestionInput(
      {
        label: "  Main course  ",
        type: "choice",
        options: [
          { id: "", label: "Beef" },
          { id: "", label: "Barramundi" },
        ],
        required: true,
        scope: "guest",
        eventId: "ev-rec",
        parentQuestionId: null,
        parentOptionId: null,
        audience: { mode: "all" },
      },
      baseCtx,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.label).toBe("Main course");
    expect(res.value.options).toEqual([
      { id: "gen-1", label: "Beef" },
      { id: "gen-2", label: "Barramundi" },
    ]);
  });

  it("requires at least 2 non-empty distinct options for choice questions", () => {
    const tooFew = validateQuestionInput(
      {
        label: "Main course",
        type: "choice",
        options: [{ id: "", label: "Only one" }],
        required: false,
        scope: "guest",
        eventId: null,
        parentQuestionId: null,
        parentOptionId: null,
        audience: { mode: "all" },
      },
      baseCtx,
    );
    expect(tooFew.ok).toBe(false);
    if (!tooFew.ok) expect(tooFew.errors.options).toMatch(/at least 2/);

    const duplicate = validateQuestionInput(
      {
        label: "Main course",
        type: "choice",
        options: [
          { id: "", label: "Beef" },
          { id: "", label: "beef" },
        ],
        required: false,
        scope: "guest",
        eventId: null,
        parentQuestionId: null,
        parentOptionId: null,
        audience: { mode: "all" },
      },
      baseCtx,
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors.options).toMatch(/different label/);
  });

  it("preserves existing option IDs when renaming and assigns new IDs to added options", () => {
    seq = 0;
    const existing = makeQuestion("meal", {
      options: [
        { id: "beef", label: "Beef" },
        { id: "fish", label: "Fish" },
      ],
    });
    const res = validateQuestionInput(
      {
        label: "Main course",
        type: "choice",
        options: [
          { id: "beef", label: "Slow-cooked beef" },
          { id: "fish", label: "Barramundi" },
          { id: "", label: "Mushroom risotto" },
        ],
        required: true,
        scope: "guest",
        eventId: null,
        parentQuestionId: null,
        parentOptionId: null,
        audience: { mode: "all" },
      },
      { ...baseCtx, editing: existing, allQuestions: [existing] },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.options).toEqual([
      { id: "beef", label: "Slow-cooked beef" },
      { id: "fish", label: "Barramundi" },
      { id: "gen-1", label: "Mushroom risotto" },
    ]);
  });

  it("blocks removing an option that already has answers and explains why", () => {
    const existing = makeQuestion("meal", {
      options: [
        { id: "beef", label: "Slow-cooked beef" },
        { id: "fish", label: "Barramundi" },
        { id: "veg", label: "Risotto" },
      ],
    });
    const res = validateQuestionInput(
      {
        label: "Main course",
        type: "choice",
        options: [
          { id: "fish", label: "Barramundi" },
          { id: "veg", label: "Risotto" },
        ],
        required: true,
        scope: "guest",
        eventId: null,
        parentQuestionId: null,
        parentOptionId: null,
        audience: { mode: "all" },
      },
      {
        ...baseCtx,
        editing: existing,
        allQuestions: [existing],
        answeredOptionIds: new Set(["beef"]),
        answerCount: 3,
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.options).toContain("Slow-cooked beef");
      expect(res.errors.options).toContain("rename");
    }
  });

  it("rejects follow-up cycles, self-reference, and mismatched scope", () => {
    const q1 = makeQuestion("q1");
    const q2 = makeQuestion("q2", { parentQuestionId: "q1", parentOptionId: "q1-yes" });
    const qh = makeQuestion("qh", { scope: "household" });

    const cycleRes = validateQuestionInput(
      {
        label: "Q1",
        type: "choice",
        options: q1.options,
        required: false,
        scope: "guest",
        eventId: null,
        parentQuestionId: "q2",
        parentOptionId: "q2-yes",
        audience: { mode: "all" },
      },
      { ...baseCtx, editing: q1, allQuestions: [q1, q2, qh], childQuestions: [q2] },
    );
    expect(cycleRes.ok).toBe(false);
    if (!cycleRes.ok) expect(cycleRes.errors.parentQuestionId).toMatch(/follow-up/);

    const scopeRes = validateQuestionInput(
      {
        label: "Guest Q",
        type: "text",
        options: [],
        required: false,
        scope: "guest",
        eventId: null,
        parentQuestionId: "qh",
        parentOptionId: "qh-yes",
        audience: { mode: "all" },
      },
      { ...baseCtx, allQuestions: [q1, q2, qh] },
    );
    expect(scopeRes.ok).toBe(false);
    if (!scopeRes.ok) expect(scopeRes.errors.parentQuestionId).toMatch(/same scope/);
  });

  it("locks type and scope once a question has answers", () => {
    const existing = makeQuestion("q1");
    const res = validateQuestionInput(
      {
        label: "Q1",
        type: "text",
        options: [],
        required: false,
        scope: "household",
        eventId: null,
        parentQuestionId: null,
        parentOptionId: null,
        audience: { mode: "all" },
      },
      { ...baseCtx, editing: existing, allQuestions: [existing], answerCount: 2 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.type).toBeDefined();
      expect(res.errors.scope).toBeDefined();
    }
  });
});

describe("parseOptionsJson & validateRsvpSettingsInput", () => {
  it("safely parses JSON option arrays", () => {
    expect(parseOptionsJson('[{"id":"a","label":"Beef"}]')).toEqual([{ id: "a", label: "Beef" }]);
    expect(parseOptionsJson("not json")).toEqual([]);
    expect(parseOptionsJson(null)).toEqual([]);
  });

  it("validates ISO calendar dates and closed message", () => {
    expect(isValidIsoDate("2027-01-31")).toBe(true);
    expect(isValidIsoDate("2027-02-30")).toBe(false);
    expect(isValidIsoDate("31/01/2027")).toBe(false);

    const okRes = validateRsvpSettingsInput({
      rsvpOpen: true,
      rsvpDeadline: "2027-01-31",
      rsvpAllowEdits: true,
      rsvpClosedMessage: "   ",
    });
    expect(okRes.ok).toBe(true);
    if (okRes.ok) expect(okRes.value.rsvpClosedMessage).toBeNull();

    const badDate = validateRsvpSettingsInput({
      rsvpOpen: true,
      rsvpDeadline: "2027-02-31",
      rsvpAllowEdits: false,
      rsvpClosedMessage: null,
    });
    expect(badDate.ok).toBe(false);
  });
});
