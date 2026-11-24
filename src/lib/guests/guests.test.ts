import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { computeStats, type WeddingSnapshot } from "@/lib/stats";
import { buildGuestExportCsv, IMPORT_HEADERS, parseGuestCsv, selectImportHouseholds, templateCsv } from "./csv";
import { filterHouseholds, type GuestListHousehold } from "./filter";
import { formatGuestSummary, isValidEmail } from "./status";

describe("status & validation helpers", () => {
  it("validates email addresses", () => {
    expect(isValidEmail("alex@example.com")).toBe(true);
    expect(isValidEmail("user+tag@sub.domain.com.au")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("formats guest summary line from computeStats", () => {
    const snap: WeddingSnapshot = {
      households: [
        { id: "h1", envelopeName: "The Jones Family", plusOnesAllowed: 0 },
        { id: "h2", envelopeName: null, plusOnesAllowed: 1 },
      ],
      guests: [
        { id: "g1", householdId: "h1", firstName: "David", lastName: "Jones", email: null, ageGroup: "adult", isPlusOne: false, tagIds: [] },
        { id: "g2", householdId: "h1", firstName: "Susan", lastName: "Jones", email: null, ageGroup: "adult", isPlusOne: false, tagIds: [] },
        { id: "g3", householdId: "h2", firstName: "Tom", lastName: "Nguyen", email: null, ageGroup: "adult", isPlusOne: false, tagIds: [] },
      ],
      events: [{ id: "e1", name: "Ceremony", audience: { mode: "all" }, rsvpEnabled: true, position: 0 }],
      questions: [],
      responses: [
        { guestId: "g1", eventId: "e1", attending: true },
        { guestId: "g2", eventId: "e1", attending: true },
      ],
      answers: [],
    };
    const stats = computeStats(snap);
    expect(formatGuestSummary(stats)).toBe("3 guests in 2 households · 2 attending · 1 awaiting reply");
  });
});

describe("filterHouseholds", () => {
  const sample: GuestListHousehold[] = [
    {
      id: "h1",
      label: "The Jones Family",
      plusOnesAllowed: 0,
      plusOnesRemaining: 0,
      rsvpState: "complete",
      members: [
        { id: "g1", firstName: "David", lastName: "Jones", email: "david@example.com", ageGroup: "adult", isPlusOne: false, tagIds: ["t-fam"], eventStatuses: [] },
        { id: "g2", firstName: "Nathan", lastName: "Jones", email: null, ageGroup: "child", isPlusOne: false, tagIds: ["t-fam"], eventStatuses: [] },
      ],
    },
    {
      id: "h2",
      label: "José García",
      plusOnesAllowed: 1,
      plusOnesRemaining: 1,
      rsvpState: "not_started",
      members: [
        { id: "g3", firstName: "José", lastName: "García", email: "jose@mail.test", ageGroup: "adult", isPlusOne: false, tagIds: ["t-friends"], eventStatuses: [] },
      ],
    },
    {
      id: "h3",
      label: "Robert & Maria Callahan",
      plusOnesAllowed: 0,
      plusOnesRemaining: 0,
      rsvpState: "partial",
      members: [
        { id: "g4", firstName: "Robert", lastName: "Callahan", email: "rob@example.com", ageGroup: "adult", isPlusOne: false, tagIds: ["t-party", "t-friends"], eventStatuses: [] },
        { id: "g5", firstName: "Maria", lastName: "Callahan", email: "maria@example.com", ageGroup: "adult", isPlusOne: false, tagIds: ["t-friends"], eventStatuses: [] },
      ],
    },
  ];

  it("matches by household label, member name (including accents), and email", () => {
    expect(filterHouseholds(sample, { query: "jones family" }).map((h) => h.id)).toEqual(["h1"]);
    expect(filterHouseholds(sample, { query: "nathan" }).map((h) => h.id)).toEqual(["h1"]);
    expect(filterHouseholds(sample, { query: "jose garcia" }).map((h) => h.id)).toEqual(["h2"]);
    expect(filterHouseholds(sample, { query: "maria@example" }).map((h) => h.id)).toEqual(["h3"]);
  });

  it("filters by tag and RSVP state individually and together", () => {
    expect(filterHouseholds(sample, { tagId: "t-friends" }).map((h) => h.id)).toEqual(["h2", "h3"]);
    expect(filterHouseholds(sample, { tagId: "t-party" }).map((h) => h.id)).toEqual(["h3"]);
    expect(filterHouseholds(sample, { rsvpState: "not_started" }).map((h) => h.id)).toEqual(["h2"]);
    expect(filterHouseholds(sample, { tagId: "t-friends", rsvpState: "partial" }).map((h) => h.id)).toEqual(["h3"]);
  });
});

describe("CSV import parsing & grouping", () => {
  it("generates a valid template CSV with exact headers", () => {
    const csv = templateCsv();
    const parsed = Papa.parse<string[]>(csv.trim());
    expect(parsed.data[0]).toEqual([...IMPORT_HEADERS]);
  });

  it("parses case-insensitive headers, extra columns, tags with ; and |, and groups households", () => {
    const csv = [
      "household,FIRST NAME,last name,Email,Phone,Child,Tags,Plus-ones,Address line 1,City,State,Postcode,Country,Notes,Extra Column",
      "The Smith Family,Alice,Smith,alice@example.com,0400111222,,Family; VIP,2,10 High St,Sydney,NSW,2000,Australia,Vegetarian,ignored1",
      "the smith family,Bob,Smith,bob@example.com,,no,Family | Work,0,99 Other St,Melbourne,VIC,3000,Australia,ignored note,ignored2",
      "The Smith Family,Charlie,Smith,,,yes,Family,,,,,,,,",
      ",Solo,Guest,solo@example.com,,,Friends,1,1 Main Rd,Bowral,NSW,2576,Australia,,",
      ",Another,Solo,,,,Friends,,,,,,,,",
    ].join("\n");

    const res = parseGuestCsv(csv, []);
    expect(res.fatalError).toBeNull();
    expect(res.errors).toEqual([]);
    expect(res.duplicates).toEqual([]);
    expect(res.validRows).toHaveLength(5);

    const selected = selectImportHouseholds(res, new Set(), [{ id: "t1", name: "Family" }]);
    expect(selected.households).toHaveLength(3);
    expect(selected.guestCount).toBe(5);
    expect(selected.newTagNames).toEqual(["VIP", "Work", "Friends"]);

    const smiths = selected.households[0];
    expect(smiths.envelopeName).toBe("The Smith Family");
    expect(smiths.members).toHaveLength(3);
    expect(smiths.members[2].ageGroup).toBe("child");
    // Address, notes & plus-ones come from the first row of the group
    expect(smiths.plusOnesAllowed).toBe(2);
    expect(smiths.addressLine1).toBe("10 High St");
    expect(smiths.city).toBe("Sydney");
    expect(smiths.notes).toBe("Vegetarian");
    expect(smiths.members[1].tags).toEqual(["Family", "Work"]);

    // Blank household rows are separate households of one
    expect(selected.households[1].envelopeName).toBeNull();
    expect(selected.households[1].displayLabel).toBe("Solo Guest");
    expect(selected.households[1].plusOnesAllowed).toBe(1);
    expect(selected.households[2].envelopeName).toBeNull();
    expect(selected.households[2].displayLabel).toBe("Another Solo");
  });

  it("reports row errors for missing names, bad emails, and invalid plus-ones", () => {
    const csv = [
      "Household,First name,Last name,Email,Plus-ones",
      ",MissingLast,,ok@example.com,0",
      ",,MissingFirst,ok@example.com,0",
      ",Bad,Email,not-an-email,0",
      ",Too,Many,ok@example.com,6",
      ",Valid,Person,valid@example.com,2",
    ].join("\n");

    const res = parseGuestCsv(csv, []);
    expect(res.validRows).toHaveLength(1);
    expect(res.errors).toHaveLength(4);
    expect(res.errors[0]).toMatchObject({ rowNumber: 2, messages: ["Missing last name."] });
    expect(res.errors[1]).toMatchObject({ rowNumber: 3, messages: ["Missing first name."] });
    expect(res.errors[2]).toMatchObject({ rowNumber: 4, messages: ["Invalid email address."] });
    expect(res.errors[3]).toMatchObject({ rowNumber: 5, messages: ["Plus-ones must be between 0 and 5."] });
  });

  it("detects normalized duplicates, skips them by default, and allows opting in", () => {
    const existing = [
      { id: "g1", firstName: "José", lastName: "O'Connor", householdLabel: "José O'Connor" },
    ];
    const csv = [
      "Household,First name,Last name,Tags",
      "O'Connor Family,jose,oconnor,Family",
      "O'Connor Family,Claire,O'Connor,Family",
      ",José,O’Connor,Friends",
    ].join("\n");

    const res = parseGuestCsv(csv, existing);
    expect(res.duplicates).toHaveLength(2);
    expect(res.duplicates.map((d) => d.rowNumber)).toEqual([2, 4]);

    // Default: skip duplicates → only Claire imported, row 4 household omitted
    const defaultSel = selectImportHouseholds(res, new Set(), []);
    expect(defaultSel.skippedDuplicates).toBe(2);
    expect(defaultSel.guestCount).toBe(1);
    expect(defaultSel.households).toHaveLength(1);
    expect(defaultSel.households[0].members.map((m) => m.firstName)).toEqual(["Claire"]);

    // Include row 2 anyway → both Jose & Claire in O'Connor Family
    const optedIn = selectImportHouseholds(res, new Set([2]), []);
    expect(optedIn.skippedDuplicates).toBe(1);
    expect(optedIn.guestCount).toBe(2);
    expect(optedIn.households).toHaveLength(1);
    expect(optedIn.households[0].members.map((m) => m.firstName)).toEqual(["jose", "Claire"]);
  });
});

describe("CSV export & re-import round-trip", () => {
  it("exports re-importable columns first, then RSVP events and active questions", () => {
    const csv = buildGuestExportCsv({
      households: [
        {
          id: "h1",
          envelopeName: "The Jones Family",
          plusOnesAllowed: 0,
          addressLine1: "10 High St",
          addressLine2: null,
          city: "Sydney",
          region: "NSW",
          postcode: "2000",
          country: "Australia",
          notes: "VIP table",
        },
        {
          id: "h2",
          envelopeName: null,
          plusOnesAllowed: 1,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postcode: null,
          country: null,
          notes: null,
        },
      ],
      guests: [
        { id: "g1", householdId: "h1", firstName: "David", lastName: "Jones", email: "david@example.com", phone: "0412345678", ageGroup: "adult", isPlusOne: false, tagIds: ["t-fam"] },
        { id: "g2", householdId: "h1", firstName: "Nathan", lastName: "Jones", email: null, phone: null, ageGroup: "child", isPlusOne: false, tagIds: ["t-fam"] },
        { id: "g3", householdId: "h2", firstName: "Priya", lastName: "Natarajan", email: "priya@example.com", phone: null, ageGroup: "adult", isPlusOne: false, tagIds: ["t-friends"] },
        { id: "g4", householdId: "h2", firstName: "Dev", lastName: "Patel", email: null, phone: null, ageGroup: "adult", isPlusOne: true, tagIds: [] },
      ],
      tags: [
        { id: "t-fam", name: "Family" },
        { id: "t-friends", name: "Friends" },
      ],
      events: [
        { id: "e1", name: "Rehearsal dinner", audience: { mode: "tags", tagIds: ["t-fam"] }, rsvpEnabled: true, position: 0 },
        { id: "e2", name: "Ceremony", audience: { mode: "all" }, rsvpEnabled: true, position: 1 },
        { id: "e3", name: "Afterparty", audience: { mode: "all" }, rsvpEnabled: false, position: 2 },
      ],
      questions: [
        {
          id: "q1",
          type: "choice",
          label: "Main course",
          options: [
            { id: "beef", label: "Slow-cooked beef" },
            { id: "veg", label: "Mushroom risotto" },
          ],
          required: true,
          scope: "guest",
          eventId: "e2",
          parentQuestionId: null,
          parentOptionId: null,
          audience: { mode: "all" },
          archived: false,
          position: 0,
        },
        {
          id: "q2",
          type: "text",
          label: "Dance floor song",
          options: [],
          required: false,
          scope: "household",
          eventId: null,
          parentQuestionId: null,
          parentOptionId: null,
          audience: { mode: "all" },
          archived: false,
          position: 1,
        },
        {
          id: "q3",
          type: "text",
          label: "Archived question",
          options: [],
          required: false,
          scope: "guest",
          eventId: null,
          parentQuestionId: null,
          parentOptionId: null,
          audience: { mode: "all" },
          archived: true,
          position: 2,
        },
      ],
      responses: [
        { guestId: "g1", eventId: "e1", attending: true },
        { guestId: "g1", eventId: "e2", attending: true },
        { guestId: "g2", eventId: "e1", attending: false },
        { guestId: "g3", eventId: "e2", attending: true },
      ],
      answers: [
        { questionId: "q1", guestId: "g1", householdId: null, value: "beef" },
        { questionId: "q2", guestId: null, householdId: "h1", value: "Mr Brightside" },
      ],
    });

    const parsed = Papa.parse<Record<string, string>>(csv.trim(), { header: true });
    expect(parsed.meta.fields).toEqual([
      "Household",
      "First name",
      "Last name",
      "Email",
      "Phone",
      "Child",
      "Plus-one",
      "Tags",
      "Plus-ones",
      "Address line 1",
      "Address line 2",
      "City",
      "State",
      "Postcode",
      "Country",
      "Notes",
      "Rehearsal dinner",
      "Ceremony",
      "Main course",
      "Dance floor song",
    ]);

    // Sorted alphabetically: Priya Natarajan, then The Jones Family
    expect(parsed.data).toHaveLength(4);
    const priya = parsed.data[0];
    expect(priya["First name"]).toBe("Priya");
    expect(priya["Rehearsal dinner"]).toBe("Not invited");
    expect(priya["Ceremony"]).toBe("Attending");
    expect(priya["Plus-ones"]).toBe("1");

    const dev = parsed.data[1];
    expect(dev["First name"]).toBe("Dev");
    expect(dev["Plus-one"]).toBe("Yes");
    expect(dev["Ceremony"]).toBe("Awaiting reply");

    const david = parsed.data[2];
    expect(david["Household"]).toBe("The Jones Family");
    expect(david["Main course"]).toBe("Slow-cooked beef");
    expect(david["Dance floor song"]).toBe("Mr Brightside");

    const nathan = parsed.data[3];
    expect(nathan["Child"]).toBe("Yes");
    expect(nathan["Rehearsal dinner"]).toBe("Declined");
    expect(nathan["Ceremony"]).toBe("Awaiting reply");
    // Household-scope answer repeated on each member
    expect(nathan["Dance floor song"]).toBe("Mr Brightside");

    // Re-import parses cleanly without errors!
    const reimport = parseGuestCsv(csv, []);
    expect(reimport.fatalError).toBeNull();
    expect(reimport.errors).toEqual([]);
    expect(reimport.validRows).toHaveLength(4);
    const grouped = selectImportHouseholds(reimport, new Set(), []);
    expect(grouped.households).toHaveLength(2);
  });
});
