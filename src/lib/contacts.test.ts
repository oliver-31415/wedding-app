import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS, matchMember, planContactApply, validateContactForm } from "./contacts";

const members = [
  { id: "g1", firstName: "David", lastName: "Jones", email: "david@example.com", phone: null },
  { id: "g2", firstName: "Susan", lastName: "Jones", email: null, phone: null },
  { id: "g3", firstName: "Nathan", lastName: "Jones", email: null, phone: null },
];

describe("validateContactForm", () => {
  it("needs a name and something to send", () => {
    expect(validateContactForm({ people: [{ firstName: "Sue" }], address: {} })).toEqual({
      ok: false,
      errors: { "people.0.lastName": "Enter a last name." },
    });
    expect(validateContactForm({ people: [{ firstName: "Sue", lastName: "Jones" }], address: {} })).toMatchObject({
      ok: false,
      errors: { form: expect.stringContaining("email address, phone number or postal address") },
    });
  });

  it("keeps extra people only when they're filled in, and checks emails and phones", () => {
    const res = validateContactForm({
      people: [
        { firstName: " Sue ", lastName: "Jones", email: "SUE@Example.com" },
        { firstName: "", lastName: "", email: "" },
        { firstName: "Nathan", lastName: "Jones", phone: "0412 345 678" },
      ],
      address: { city: "Bowral", postcode: "2576" },
      note: "  See you there  ",
    });
    expect(res).toEqual({
      ok: true,
      people: [
        { firstName: "Sue", lastName: "Jones", email: "sue@example.com", phone: null },
        { firstName: "Nathan", lastName: "Jones", email: null, phone: "0412 345 678" },
      ],
      address: { ...EMPTY_ADDRESS, city: "Bowral", postcode: "2576" },
      note: "See you there",
    });
    expect(
      validateContactForm({ people: [{ firstName: "A", lastName: "B", email: "nope", phone: "call me" }], address: {} }),
    ).toMatchObject({ ok: false, errors: { "people.0.email": expect.any(String), "people.0.phone": expect.any(String) } });
  });
});

describe("matchMember", () => {
  it("matches the full name, then a first name that's unique in the household", () => {
    expect(matchMember({ firstName: "susan", lastName: "JONES" }, members)?.id).toBe("g2");
    expect(matchMember({ firstName: "Nathan", lastName: "Smith-Jones" }, members)?.id).toBe("g3");
    expect(matchMember({ firstName: "Kate", lastName: "Jones" }, members)).toBeNull();
  });
});

describe("planContactApply", () => {
  it("fills in and changes details, adds unknown people, never erases", () => {
    const plan = planContactApply(
      {
        people: [
          { firstName: "David", lastName: "Jones", email: null, phone: "0400 000 000" },
          { firstName: "Susan", lastName: "Jones", email: "sue@example.com", phone: null },
          { firstName: "Nathan", lastName: "Jones", email: null, phone: null },
          { firstName: "Kate", lastName: "Jones", email: "kate@example.com", phone: null },
        ],
        address: { ...EMPTY_ADDRESS, addressLine1: "1 Bong Bong St", city: "Bowral" },
      },
      members,
      EMPTY_ADDRESS,
    );
    expect(plan.updates).toEqual([
      { guestId: "g1", name: "David Jones", phone: { from: null, to: "0400 000 000" } },
      { guestId: "g2", name: "Susan Jones", email: { from: null, to: "sue@example.com" } },
    ]);
    expect(plan.unchanged).toEqual([{ guestId: "g3", name: "Nathan Jones" }]);
    expect(plan.additions.map((p) => p.firstName)).toEqual(["Kate"]);
    expect(plan.address).toEqual({ from: [], to: ["1 Bong Bong St", "Bowral"] });
  });

  it("doesn't match two submitted people to the same guest", () => {
    const plan = planContactApply(
      {
        people: [
          { firstName: "Susan", lastName: "Jones", email: "a@example.com", phone: null },
          { firstName: "Susan", lastName: "Jones", email: "b@example.com", phone: null },
        ],
        address: EMPTY_ADDRESS,
      },
      members,
      EMPTY_ADDRESS,
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.additions).toHaveLength(1);
    expect(plan.address).toBeNull();
  });
});
