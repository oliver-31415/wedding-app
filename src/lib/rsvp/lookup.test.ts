import { describe, expect, it } from "vitest";
import { editDistance, findInvitation, nameKey, normalizeName, soundKey, suggestGuests } from "./lookup";
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
    // …and the other way round: a guest typing their newer double-barrelled name.
    expect(findInvitation("Susan", "Smith-Brown", guests)).toEqual({ kind: "choose", options: [{ householdId: "h7", label: "Susan Smith" }] });
  });

  it("needs at least three letters for a prefix match", () => {
    expect(findInvitation("Su", "Smith", guests)).toEqual({ kind: "none" });
    expect(findInvitation("Sus", "Smith", guests).kind).toBe("choose");
  });

  it("finds nothing for unknown names", () => {
    expect(findInvitation("Jane", "Doe", guests)).toEqual({ kind: "none" });
    expect(findInvitation("Ro", "Callahan", guests)).toEqual({ kind: "none" });
    expect(findInvitation("", "Callahan", guests)).toEqual({ kind: "none" });
  });

  it("normalizes names", () => {
    expect(normalizeName("  Zoë   O’Brien-Smith ")).toBe("zoe obrien smith");
  });
});

describe("findInvitation safety", () => {
  const compound = [
    guest("mj", "h1", { firstName: "Mary-Jane", lastName: "Smith" }),
    guest("rj", "h2", { firstName: "Robert James", lastName: "Brown" }),
    guest("dl", "h3", { firstName: "Sarah", lastName: "De Luca" }),
    guest("sj", "h4", { firstName: "Sarah", lastName: "Smith-Jones" }),
  ];

  it("never treats a different compound first name as the same person", () => {
    expect(findInvitation("Mary-Anne", "Smith", compound).kind).toBe("none");
    expect(findInvitation("Mary Jane", "Smith", compound)).toEqual({ kind: "match", householdId: "h1" });
    expect(suggestGuests("Mary-Anne", "Smith", compound)[0]).toMatchObject({ tier: "unsure" });
  });

  it("offers the first part of a compound first name, or a nickname for it, to confirm", () => {
    expect(findInvitation("Mary", "Smith", compound).kind).toBe("choose");
    expect(findInvitation("Bob", "Brown", compound).kind).toBe("choose");
  });

  it("doesn't match on a surname particle alone", () => {
    expect(findInvitation("Sarah", "De", compound).kind).toBe("none");
    expect(findInvitation("Sarah", "Van De", compound).kind).toBe("none");
  });

  it("can't test a long list of surnames in one search", () => {
    expect(findInvitation("Sarah", "Brown Taylor Wilson Smith Evans", compound).kind).toBe("none");
    expect(findInvitation("Sarah", "Smith Jones", compound)).toEqual({ kind: "match", householdId: "h4" });
  });

  it("needs a whole first name when only part of the surname matches", () => {
    expect(findInvitation("Sar", "Jones", compound).kind).toBe("none");
    expect(findInvitation("Sarah", "Jones", compound).kind).toBe("choose");
  });
});

describe("findInvitation with typos", () => {
  const list = [
    guest("rebecca", "r", { firstName: "Rebecca", lastName: "Jones" }),
    guest("sarah", "s", { firstName: "Sarah", lastName: "Smith" }),
    guest("john", "j", { firstName: "John", lastName: "Citizen" }),
    guest("katherine", "k", { firstName: "Katherine", lastName: "Nguyen" }),
    guest("pam", "p", { firstName: "Pam", lastName: "Jones" }),
    guest("joan", "jo", { firstName: "Joan", lastName: "Smith" }),
    guest("sean", "se", { firstName: "Sean", lastName: "Murphy" }),
    guest("philippa", "ph", { firstName: "Philippa", lastName: "Grant" }),
    guest("lachlan", "l", { firstName: "Lachlan", lastName: "McDonald" }),
    guest("robert", "rc", { firstName: "Robert", lastName: "Callahan" }),
  ];
  const option = (householdId: string, label: string) => ({ kind: "choose", options: [{ householdId, label }] });

  it("offers a single typo in a reasonably long name to confirm", () => {
    expect(findInvitation("Rebbeca", "Jones", list)).toEqual(option("r", "Rebecca Jones"));
    expect(findInvitation("Rebeca", "Jones", list)).toEqual(option("r", "Rebecca Jones"));
    expect(findInvitation("Sarah", "Smtih", list)).toEqual(option("s", "Sarah Smith"));
    expect(findInvitation("Kathrine", "Nguyen", list)).toEqual(option("k", "Katherine Nguyen"));
    expect(findInvitation("Katherine", "Nguyan", list)).toEqual(option("k", "Katherine Nguyen"));
    expect(findInvitation("Phillipa", "Grant", list)).toEqual(option("ph", "Philippa Grant"));
    expect(findInvitation("Lachlan", "MacDonald", list)).toEqual(option("l", "Lachlan McDonald"));
  });

  it("trusts a swap or a doubled letter in a four-letter name, nothing else", () => {
    expect(findInvitation("Jhon", "Citizen", list)).toEqual(option("j", "John Citizen"));
    expect(findInvitation("Johnn", "Citizen", list)).toEqual(option("j", "John Citizen"));
    expect(findInvitation("Joan", "Citizen", list)).toEqual({ kind: "none" });
  });

  it("allows a nickname with a typo in the surname", () => {
    expect(findInvitation("Bob", "Calahan", list)).toEqual(option("rc", "Robert Callahan"));
  });

  it("never logs in on a fuzzy match", () => {
    for (const [f, l] of [["Rebbeca", "Jones"], ["Sarah", "Smtih"], ["Jhon", "Citizen"]]) {
      expect(findInvitation(f, l, list).kind).not.toBe("match");
    }
  });

  it("doesn't offer unsure matches to the guest", () => {
    // One letter, but in a short name: different people.
    expect(findInvitation("Sam", "Jones", list)).toEqual({ kind: "none" });
    // Two typos.
    expect(findInvitation("Rebeka", "Jonse", list)).toEqual({ kind: "none" });
    expect(findInvitation("Sara", "Smyth", list)).toEqual({ kind: "none" });
    // Sounds alike only.
    expect(findInvitation("Shaun", "Murphy", list)).toEqual({ kind: "none" });
    // Same first name, quite different surname.
    expect(findInvitation("Rebecca", "Williams", list)).toEqual({ kind: "none" });
    // A typo in a short name plus a typo in the surname.
    expect(findInvitation("Jon", "Smiht", list)).toEqual({ kind: "none" });
  });

  it("prefers exact matches over fuzzy ones", () => {
    const two = [...list, guest("sara", "s2", { firstName: "Sara", lastName: "Smith" })];
    expect(findInvitation("Sara", "Smith", two)).toEqual({ kind: "match", householdId: "s2" });
  });

  it("ignores accents and case in fuzzy matches", () => {
    expect(findInvitation("RÉBBECA", "jones", list)).toEqual(option("r", "Rebecca Jones"));
    const accented = [guest("zoe", "z", { firstName: "Zoë", lastName: "O'Brien-Smith" })];
    expect(findInvitation("zoe", "OBrien Smyth", accented)).toEqual(option("z", "Zoë O'Brien-Smith"));
  });

  it("says too many when the typo could be several households", () => {
    const many = ["Smith", "Smyth", "Smoth", "Smithe", "Smiths"].map((last, i) =>
      guest(`g${i}`, `h${i}`, { firstName: "Sarah", lastName: last }),
    );
    expect(findInvitation("Sarah", "Smiths", many)).toEqual({ kind: "match", householdId: "h4" });
    const five = [0, 1, 2, 3, 4].map((i) => guest(`r${i}`, `h${i}`, { firstName: "Rebecca", lastName: "Jones" }));
    expect(findInvitation("Rebeca", "Jones", five)).toEqual({ kind: "too_many" });
  });

  it("lists the closest match first", () => {
    const close = [
      guest("a", "ha", { firstName: "Rebecca", lastName: "Jonas" }),
      guest("b", "hb", { firstName: "Rebecca", lastName: "Jones-Hill" }),
    ];
    const r = findInvitation("Rebecca", "Jones", close);
    expect(r.kind).toBe("choose");
    if (r.kind === "choose") expect(r.options.map((o) => o.householdId)).toEqual(["ha", "hb"]);
  });
});

describe("findInvitation with aliases", () => {
  const list = [
    guest("john", "h1", { firstName: "John", lastName: "Smith" }),
    guest("jon", "h2", { firstName: "Jon", lastName: "Smyth" }),
    guest("mary", "h3", { firstName: "Mary", lastName: "Brown" }),
  ];

  it("logs in straight away with a name the couple accepted", () => {
    const aliases = [{ firstName: "Jonny", lastName: "Smiff", guestId: "john" }];
    expect(findInvitation("Jonny", "Smiff", list)).toEqual({ kind: "none" });
    expect(findInvitation("jonny", "SMIFF", list, aliases)).toEqual({ kind: "match", householdId: "h1" });
    expect(findInvitation("Mr Jonny", "Smiff.", list, aliases)).toEqual({ kind: "match", householdId: "h1" });
  });

  it("covers a married name the couple linked", () => {
    const aliases = [{ firstName: "Mary", lastName: "Williams", guestId: "mary" }];
    expect(findInvitation("Mary", "Williams", list, aliases)).toEqual({ kind: "match", householdId: "h3" });
  });

  it("asks to choose when an alias and a real guest share the name", () => {
    const aliases = [{ firstName: "Jon", lastName: "Smyth", guestId: "john" }];
    expect(findInvitation("Jon", "Smyth", list, aliases).kind).toBe("choose");
  });

  it("ignores aliases whose guest is gone", () => {
    const aliases = [
      { firstName: "Jonny", lastName: "Smiff", guestId: null },
      { firstName: "Jonny", lastName: "Smiff", guestId: "deleted" },
    ];
    expect(findInvitation("Jonny", "Smiff", list, aliases)).toEqual({ kind: "none" });
  });
});

describe("suggestGuests", () => {
  const list = [
    guest("pam", "h1", { firstName: "Pam", lastName: "Jones" }),
    guest("rebecca", "h2", { firstName: "Rebecca", lastName: "Jones" }),
    guest("sean", "h3", { firstName: "Sean", lastName: "Murphy" }),
    guest("sarah", "h4", { firstName: "Sarah", lastName: "Smith" }),
    guest("jonathan", "h5", { firstName: "Jonathan", lastName: "Lee" }),
    guest("al", "h6", { firstName: "Ali", lastName: "Khan" }),
  ];
  const reasons = (f: string, l: string) => suggestGuests(f, l, list).map((s) => [s.guest.id, s.tier, s.reason]);

  it("explains unsure matches in plain words", () => {
    expect(reasons("Sam", "Jones")[0]).toEqual(["pam", "unsure", "One letter different in the first name"]);
    expect(reasons("Shaun", "Murphy")).toEqual([["sean", "unsure", "The first name sounds the same"]]);
    expect(reasons("Sarah", "Smtih")).toEqual([["sarah", "confident", "Two letters swapped in the surname"]]);
    expect(reasons("Sarah", "Williams")).toEqual([["sarah", "unsure", "Same first name"]]);
    expect(reasons("Rebbeca", "Jones")[0]).toEqual(["rebecca", "confident", "A letter doubled differently in the first name"]);
    expect(reasons("Rebeka", "Jonse")[0]).toEqual(["rebecca", "unsure", "A letter or two different in each name"]);
    expect(reasons("Sean", "Murphey")).toEqual([["sean", "confident", "One letter different in the surname"]]);
    expect(reasons("Shaun", "Murphey")).toEqual([
      ["sean", "unsure", "The first name sounds the same, and one letter different in the surname"],
    ]);
    expect(reasons("Seen", "Murphey")[0]).toEqual(["sean", "unsure", "One letter different in each name"]);
    expect(reasons("Jon", "Lee")[0]).toEqual(["jonathan", "confident", "A nickname for the first name"]);
  });

  it("ranks closer matches first and respects the limit", () => {
    const s = suggestGuests("Rebecca", "Jones", list);
    expect(s[0]).toMatchObject({ guest: { id: "rebecca" }, tier: "exact", reason: "Same name" });
    expect(s.map((x) => x.guest.id)).toContain("pam"); // same surname
    expect(suggestGuests("Rebecca", "Jones", list, 1)).toHaveLength(1);
  });

  it("has stricter rules for short names", () => {
    expect(suggestGuests("Al", "Khan", list)).toEqual([expect.objectContaining({ reason: "Same surname" })]);
    // "Bo" is too short to be like anyone's first name; only the surname is shared.
    expect(suggestGuests("Bo", "Smith", list)).toEqual([expect.objectContaining({ reason: "Same surname" })]);
    expect(suggestGuests("Bo", "Smit", list)).toEqual([]);
  });

  it("includes names the couple accepted before", () => {
    const s = suggestGuests("Becky", "Jonesy", list, 3, [{ firstName: "Becky", lastName: "Jonesy", guestId: "rebecca" }]);
    expect(s[0]).toMatchObject({ guest: { id: "rebecca" }, reason: "You matched this name to them before" });
  });

  it("returns nothing for blank or unrelated names", () => {
    expect(suggestGuests("", "", list)).toEqual([]);
    expect(suggestGuests("Xavier", "Quill", list)).toEqual([]);
  });
});

describe("spelling helpers", () => {
  it("counts a swap of neighbouring letters as one edit", () => {
    expect(editDistance("smith", "smtih")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });

  it("gives names that sound alike the same key", () => {
    expect(soundKey("smith")).toBe(soundKey("smyth"));
    expect(soundKey("catherine")).toBe(soundKey("kathryn"));
    expect(soundKey("stephen")).toBe(soundKey("steven"));
    expect(soundKey("sean")).toBe(soundKey("shaun"));
    expect(soundKey("leigh")).toBe(soundKey("lee"));
    expect(soundKey("sam")).not.toBe(soundKey("pam"));
    expect(soundKey("smith")).not.toBe(soundKey("jones"));
  });

  it("compares typed names by the same key as the lookup", () => {
    expect(nameKey("Dr Zoë", "O'Brien-Smith")).toBe(nameKey("zoe", "obrien smith"));
    expect(nameKey("Jon", "Smith")).not.toBe(nameKey("John", "Smith"));
  });
});
