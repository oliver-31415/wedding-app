import { describe, expect, it } from "vitest";
import {
  describeQuestionConditions,
  describeQuestionRemovalConfirm,
  formatQuestionConditions,
} from "./conditions";

const lookups = {
  eventsById: new Map([
    ["rec", { id: "rec", name: "Reception", rsvpEnabled: true }],
    ["brunch", { id: "brunch", name: "Recovery brunch", rsvpEnabled: false }],
  ]),
  questionsById: new Map([
    [
      "diet",
      {
        id: "diet",
        label: "Any dietary requirements?",
        options: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ],
        archived: false,
      },
    ],
    [
      "old",
      {
        id: "old",
        label: "Old question",
        options: [{ id: "a", label: "Option A" }],
        archived: true,
      },
    ],
  ]),
  tagsById: new Map([
    ["fam", "Family"],
    ["wp", "Wedding party"],
  ]),
};

describe("describeQuestionConditions", () => {
  it("describes an unconditional guest question", () => {
    expect(
      describeQuestionConditions(
        {
          scope: "guest",
          eventId: null,
          parentQuestionId: null,
          parentOptionId: null,
          audience: { mode: "all" },
        },
        lookups,
      ),
    ).toEqual(["Asked of guests coming to at least one event"]);
  });

  it("describes an unconditional household question", () => {
    expect(
      describeQuestionConditions(
        {
          scope: "household",
          eventId: null,
          parentQuestionId: null,
          parentOptionId: null,
          audience: { mode: "all" },
        },
        lookups,
      ),
    ).toEqual(["Asked of households coming to at least one event"]);
  });

  it("describes event, follow-up, and tag conditions together", () => {
    const clauses = describeQuestionConditions(
      {
        scope: "guest",
        eventId: "rec",
        parentQuestionId: "diet",
        parentOptionId: "yes",
        audience: { mode: "tags", tagIds: ["fam"] },
      },
      lookups,
    );
    expect(clauses).toEqual([
      "Asked of guests attending Reception",
      "Only if they answered 'Yes' to 'Any dietary requirements?'",
      "Only guests tagged Family",
    ]);
    expect(
      formatQuestionConditions(
        {
          scope: "guest",
          eventId: "rec",
          parentQuestionId: "diet",
          parentOptionId: "yes",
          audience: { mode: "tags", tagIds: ["fam", "wp"] },
        },
        lookups,
      ),
    ).toBe(
      "Asked of guests attending Reception · Only if they answered 'Yes' to 'Any dietary requirements?' · Only guests tagged Family, Wedding party",
    );
  });

  it("describes household event questions", () => {
    expect(
      describeQuestionConditions(
        {
          scope: "household",
          eventId: "rec",
          parentQuestionId: null,
          parentOptionId: null,
          audience: { mode: "all" },
        },
        lookups,
      ),
    ).toEqual(["Asked of households attending Reception"]);
  });

  it("flags disabled events, archived parents, and removed tags", () => {
    expect(
      describeQuestionConditions(
        {
          scope: "guest",
          eventId: "brunch",
          parentQuestionId: "old",
          parentOptionId: "a",
          audience: { mode: "tags", tagIds: ["missing"] },
        },
        lookups,
      ),
    ).toEqual([
      "Asked of guests attending Recovery brunch (RSVPs turned off for this event)",
      "Only if they answered 'Option A' to 'Old question' (parent archived — won't be asked)",
      "No guests (selected tags were removed)",
    ]);
  });
});

describe("describeQuestionRemovalConfirm", () => {
  it("warns when deleting or archiving a parent with follow-ups", () => {
    expect(
      describeQuestionRemovalConfirm("Any dietary requirements?", ["Tell us about them"], "archive"),
    ).toContain("Its follow-up question (“Tell us about them”) won't be asked any more.");

    expect(
      describeQuestionRemovalConfirm("Meal", ["Side dish", "Sauce"], "delete"),
    ).toContain("Its 2 follow-up questions (“Side dish”, “Sauce”) won't be asked any more.");
  });

  it("gives a straightforward message when there are no follow-ups", () => {
    expect(describeQuestionRemovalConfirm("Song request", [], "delete")).toBe(
      "Delete “Song request”? This can't be undone.",
    );
    expect(describeQuestionRemovalConfirm("Main course", [], "archive")).toContain(
      "Existing answers will be kept",
    );
  });
});
