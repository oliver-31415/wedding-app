import { describe, expect, it } from "vitest";
import { findInvitation, normalizeName } from "./lookup";
import { guest } from "./fixtures";

const guests = [
  guest("robert", "h1", { firstName: "Robert", lastName: "Callahan" }),
  guest("zoe", "h2", { firstName: "Zoë", lastName: "O'Brien-Smith" }),
  guest("sam1", "h3", { firstName: "Sam", lastName: "Lee" }),
  guest("sam2", "h4", { firstName: "Sam", lastName: "Lee" }),
  guest("lachlan", "h5", { firstName: "Lachlan", lastName: "McDonald" }),
  guest("sarah", "h6", { firstName: "Sarah", lastName: "Smith-Jones" }),
  guest("susan", "h7", { firstName: "Susan", lastName: "Smith" }),
];

describe("findInvitation", () => {
  it("matches exact names, ignoring case, accents and punctuation", () => {
    expect(findInvitation(" robert ", "CALLAHAN", guests)).toEqual({ kind: "match", householdId: "h1" });
    expect(findInvitation("Zoe", "obrien smith", guests)).toEqual({ kind: "match", householdId: "h2" });
  });

  it("asks to choose when two households share a name", () => {
    const r = findInvitation("Sam", "Lee", guests);
    expect(r.kind).toBe("choose");
  });

  it("offers near matches to confirm, never logs straight in", () => {
    expect(findInvitation("Rob", "Callahan", guests)).toEqual({
      kind: "choose",
      options: [{ householdId: "h1", label: "Robert Callahan" }],
    });
    expect(findInvitation("Callahan", "Robert", guests).kind).toBe("choose");
  });

  it("handles spacing in surnames, honorifics and nicknames", () => {
    expect(findInvitation("Lachlan", "Mc Donald", guests)).toEqual({ kind: "match", householdId: "h5" });
    expect(findInvitation("Dr Lachlan", "McDonald", guests)).toEqual({ kind: "match", householdId: "h5" });
    expect(findInvitation("Lachie", "McDonald", guests)).toEqual({ kind: "choose", options: [{ householdId: "h5", label: "Lachlan McDonald" }] });
    expect(findInvitation("Bob", "Callahan", guests).kind).toBe("choose");
  });

  it("offers one half of a double-barrelled surname as a near match", () => {
    expect(findInvitation("Sarah", "Smith", guests)).toEqual({ kind: "choose", options: [{ householdId: "h6", label: "Sarah Smith-Jones" }] });
  });

  it("needs at least three letters for a prefix match", () => {
    expect(findInvitation("Su", "Smith", guests)).toEqual({ kind: "none" });
    expect(findInvitation("Sus", "Smith", guests).kind).toBe("choose");
  });

  it("finds nothing for unknown names", () => {
    expect(findInvitation("Jane", "Doe", guests)).toEqual({ kind: "none" });
    expect(findInvitation("Ro", "Callahan", guests)).toEqual({ kind: "none" });
  });

  it("normalizes names", () => {
    expect(normalizeName("  Zoë   O’Brien-Smith ")).toBe("zoe obrien smith");
  });
});
