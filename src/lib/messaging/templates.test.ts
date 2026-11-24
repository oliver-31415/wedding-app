import { describe, expect, it } from "vitest";
import { buildMessageTemplate, type TemplateWedding } from "./templates";

const fullWedding: TemplateWedding = {
  partnerOne: "Alex",
  partnerTwo: "Sam",
  date: "2027-03-13",
  locationName: "Bowral, NSW",
  rsvpDeadline: "2027-01-31",
};

const minimalWedding: TemplateWedding = {
  partnerOne: "Alex",
  partnerTwo: "Sam",
  date: null,
  locationName: null,
  rsvpDeadline: null,
};

describe("buildMessageTemplate", () => {
  describe("save_the_date", () => {
    it("includes date and location when both are set", () => {
      const t = buildMessageTemplate("save_the_date", fullWedding);
      expect(t.subject).toBe("Save the date — Alex & Sam");
      expect(t.body).toMatch(/^Hi \{first_name\},/);
      expect(t.body).toContain("Saturday 13 March 2027");
      expect(t.body).toContain("Bowral, NSW");
      expect(t.body.trimEnd()).toMatch(/Alex & Sam$/);
      expect(t.buttonTarget).toBe("site");
      expect(t.buttonLabel).toBe("Visit our website");
      expect(t.recipients).toEqual({ audience: { mode: "all" }, rsvpStatus: "any" });
    });

    it("omits missing date or location without placeholders", () => {
      const noLocation = buildMessageTemplate("save_the_date", {
        ...fullWedding,
        locationName: null,
      });
      expect(noLocation.body).toContain("Saturday 13 March 2027");
      expect(noLocation.body).not.toContain("Bowral");
      expect(noLocation.body).not.toMatch(/TBD|TBA/i);

      const noDate = buildMessageTemplate("save_the_date", {
        ...fullWedding,
        date: null,
      });
      expect(noDate.body).toContain("Bowral, NSW");
      expect(noDate.body).not.toContain("2027");
      expect(noDate.body).not.toMatch(/TBD|TBA/i);

      const neither = buildMessageTemplate("save_the_date", minimalWedding);
      expect(neither.body).toMatch(/^Hi \{first_name\},/);
      expect(neither.body.trimEnd()).toMatch(/Alex & Sam$/);
      expect(neither.body).not.toMatch(/TBD|TBA|undefined|null/i);
    });
  });

  describe("invitation", () => {
    it("includes date, location and RSVP deadline when set", () => {
      const t = buildMessageTemplate("invitation", fullWedding);
      expect(t.subject).toBe("You're invited — Alex & Sam");
      expect(t.body).toMatch(/^Hi \{first_name\},/);
      expect(t.body).toContain("Saturday 13 March 2027");
      expect(t.body).toContain("Bowral, NSW");
      expect(t.body).toContain("Sunday 31 January 2027");
      expect(t.body.trimEnd()).toMatch(/Alex & Sam$/);
      expect(t.buttonTarget).toBe("rsvp");
      expect(t.buttonLabel).toBe("RSVP");
      expect(t.recipients).toEqual({ audience: { mode: "all" }, rsvpStatus: "any" });
    });

    it("omits date, location and deadline when unset", () => {
      const t = buildMessageTemplate("invitation", minimalWedding);
      expect(t.body).toMatch(/^Hi \{first_name\},/);
      expect(t.body).not.toContain(" by ");
      expect(t.body).not.toMatch(/TBD|TBA|undefined|null/i);
      expect(t.body.trimEnd()).toMatch(/Alex & Sam$/);
    });
  });

  describe("rsvp_reminder", () => {
    it("defaults recipients to not_responded and mentions deadline only when set", () => {
      const withDeadline = buildMessageTemplate("rsvp_reminder", fullWedding);
      expect(withDeadline.subject).toBe("Reminder: please RSVP — Alex & Sam");
      expect(withDeadline.body).toMatch(/^Hi \{first_name\},/);
      expect(withDeadline.body).toContain("Sunday 31 January 2027");
      expect(withDeadline.body).toContain("finalise");
      expect(withDeadline.body.trimEnd()).toMatch(/Alex & Sam$/);
      expect(withDeadline.buttonTarget).toBe("rsvp");
      expect(withDeadline.buttonLabel).toBe("RSVP");
      expect(withDeadline.recipients).toEqual({
        audience: { mode: "all" },
        rsvpStatus: "not_responded",
      });

      const withoutDeadline = buildMessageTemplate("rsvp_reminder", minimalWedding);
      expect(withoutDeadline.body).not.toContain("finalise");
      expect(withoutDeadline.body).not.toMatch(/TBD|TBA|undefined|null/i);
    });
  });

  describe("custom", () => {
    it("starts empty with no button", () => {
      const t = buildMessageTemplate("custom", fullWedding);
      expect(t.subject).toBe("");
      expect(t.body).toBe("");
      expect(t.buttonTarget).toBeNull();
      expect(t.buttonLabel).toBeNull();
      expect(t.recipients).toEqual({ audience: { mode: "all" }, rsvpStatus: "any" });
    });
  });
});
