import Papa from "papaparse";
import { normalizeName } from "@/lib/rsvp/lookup";
import {
  answerLabel,
  guestEventStatus,
  householdLabel,
  responsesMap,
  sortByPosition,
  type SnapAnswer,
  type SnapEvent,
  type SnapGuest,
  type SnapQuestion,
  type SnapResponse,
} from "@/lib/rsvp/model";
import { GUEST_EVENT_STATUS_META, isValidEmail } from "./status";

export const IMPORT_HEADERS = [
  "Household",
  "First name",
  "Last name",
  "Email",
  "Phone",
  "Child",
  "Tags",
  "Plus-ones",
  "Address line 1",
  "Address line 2",
  "City",
  "State",
  "Postcode",
  "Country",
  "Notes",
] as const;

export function templateCsv(): string {
  return `${Papa.unparse([Array.from(IMPORT_HEADERS)])}\r\n`;
}

// ---------------------------------------------------------------- import

export type ExistingGuestRef = {
  id: string;
  firstName: string;
  lastName: string;
  householdLabel: string;
};

export type ExistingTagRef = {
  id: string;
  name: string;
};

export type CsvRowError = {
  rowNumber: number;
  name: string;
  messages: string[];
};

export type ParsedGuestRow = {
  rowNumber: number;
  /** Trimmed Household value, or null when blank (household of one). */
  householdName: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  ageGroup: "adult" | "child";
  tags: string[];
  plusOnesAllowed: number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  notes: string | null;
  duplicateOf: {
    guestId: string;
    name: string;
    householdLabel: string;
  } | null;
};

export type CsvParseResult = {
  validRows: ParsedGuestRow[];
  errors: CsvRowError[];
  duplicates: ParsedGuestRow[];
  totalDataRows: number;
  fatalError: string | null;
};

export type ImportHouseholdGroup = {
  key: string;
  envelopeName: string | null;
  displayLabel: string;
  plusOnesAllowed: number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  notes: string | null;
  members: ParsedGuestRow[];
};

export type SelectedImport = {
  households: ImportHouseholdGroup[];
  guestCount: number;
  skippedDuplicates: number;
  newTagNames: string[];
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

type CanonicalField =
  | "household"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "child"
  | "tags"
  | "plusOnes"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "region"
  | "postcode"
  | "country"
  | "notes";

const HEADER_MAP: Record<string, CanonicalField> = {
  household: "household",
  "first name": "firstName",
  firstname: "firstName",
  "last name": "lastName",
  lastname: "lastName",
  email: "email",
  phone: "phone",
  child: "child",
  tags: "tags",
  "plus ones": "plusOnes",
  plusones: "plusOnes",
  "address line 1": "addressLine1",
  "address 1": "addressLine1",
  "address line 2": "addressLine2",
  "address 2": "addressLine2",
  city: "city",
  state: "region",
  region: "region",
  postcode: "postcode",
  "postal code": "postcode",
  country: "country",
  notes: "notes",
};

function parseChildFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "yes" || v === "y" || v === "true" || v === "1" || v === "child";
}

function parseTagsCell(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[;|]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function trimOrNull(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

export function normalizedGuestKey(firstName: string, lastName: string): string {
  return `${normalizeName(firstName)}|${normalizeName(lastName)}`;
}

/**
 * Parses a CSV upload for guest import. Case-insensitive headers, tolerant of
 * extra columns. Validates required names, email format and plus-ones range,
 * and flags possible duplicates against existing guests using `normalizeName`.
 */
export function parseGuestCsv(csvText: string, existingGuests: ExistingGuestRef[]): CsvParseResult {
  const cleaned = csvText.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) {
    return {
      validRows: [],
      errors: [],
      duplicates: [],
      totalDataRows: 0,
      fatalError: "The uploaded file is empty.",
    };
  }

  const parsed = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      validRows: [],
      errors: [],
      duplicates: [],
      totalDataRows: 0,
      fatalError: `Could not read CSV: ${parsed.errors[0].message}`,
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return {
      validRows: [],
      errors: [],
      duplicates: [],
      totalDataRows: 0,
      fatalError: "The uploaded file is empty.",
    };
  }

  const headerRow = rows[0] ?? [];
  const colIndex = new Map<CanonicalField, number>();
  headerRow.forEach((rawHeader, idx) => {
    const field = HEADER_MAP[normalizeHeader(rawHeader)];
    if (field && !colIndex.has(field)) colIndex.set(field, idx);
  });

  if (!colIndex.has("firstName") || !colIndex.has("lastName")) {
    return {
      validRows: [],
      errors: [],
      duplicates: [],
      totalDataRows: 0,
      fatalError: 'The CSV must include "First name" and "Last name" columns.',
    };
  }

  const existingByName = new Map<string, ExistingGuestRef>();
  for (const g of existingGuests) {
    const key = normalizedGuestKey(g.firstName, g.lastName);
    if (!existingByName.has(key)) existingByName.set(key, g);
  }

  const cell = (row: string[], field: CanonicalField): string => {
    const idx = colIndex.get(field);
    return idx === undefined ? "" : (row[idx] ?? "");
  };

  const validRows: ParsedGuestRow[] = [];
  const errors: CsvRowError[] = [];
  const duplicates: ParsedGuestRow[] = [];
  let totalDataRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => c.trim() === "")) continue;

    totalDataRows++;
    const rowNumber = i + 1; // 1-based CSV line number (row 1 is header)

    const firstName = cell(row, "firstName").trim();
    const lastName = cell(row, "lastName").trim();
    const email = trimOrNull(cell(row, "email"));
    const plusOnesRaw = cell(row, "plusOnes").trim();

    const messages: string[] = [];
    if (!firstName) messages.push("Missing first name.");
    if (!lastName) messages.push("Missing last name.");
    if (email && !isValidEmail(email)) messages.push("Invalid email address.");

    let plusOnesAllowed = 0;
    if (plusOnesRaw !== "") {
      if (!/^\d+$/.test(plusOnesRaw)) {
        messages.push("Plus-ones must be a whole number between 0 and 5.");
      } else {
        const n = Number.parseInt(plusOnesRaw, 10);
        if (n < 0 || n > 5) messages.push("Plus-ones must be between 0 and 5.");
        else plusOnesAllowed = n;
      }
    }

    if (messages.length > 0) {
      errors.push({
        rowNumber,
        name: [firstName, lastName].filter(Boolean).join(" ") || "(unnamed)",
        messages,
      });
      continue;
    }

    const match = existingByName.get(normalizedGuestKey(firstName, lastName));
    const parsedRow: ParsedGuestRow = {
      rowNumber,
      householdName: trimOrNull(cell(row, "household")),
      firstName,
      lastName,
      email,
      phone: trimOrNull(cell(row, "phone")),
      ageGroup: parseChildFlag(cell(row, "child")) ? "child" : "adult",
      tags: parseTagsCell(cell(row, "tags")),
      plusOnesAllowed,
      addressLine1: trimOrNull(cell(row, "addressLine1")),
      addressLine2: trimOrNull(cell(row, "addressLine2")),
      city: trimOrNull(cell(row, "city")),
      region: trimOrNull(cell(row, "region")),
      postcode: trimOrNull(cell(row, "postcode")),
      country: trimOrNull(cell(row, "country")),
      notes: trimOrNull(cell(row, "notes")),
      duplicateOf: match
        ? {
            guestId: match.id,
            name: `${match.firstName} ${match.lastName}`.trim(),
            householdLabel: match.householdLabel,
          }
        : null,
    };

    validRows.push(parsedRow);
    if (parsedRow.duplicateOf) duplicates.push(parsedRow);
  }

  return { validRows, errors, duplicates, totalDataRows, fatalError: null };
}

/**
 * Groups parsed rows into households after applying duplicate opt-ins.
 * Rows sharing a non-blank `Household` value form one household (plus-ones,
 * address and notes taken from the first row of the group); blank `Household`
 * forms a household of one.
 */
export function selectImportHouseholds(
  parsed: CsvParseResult,
  includedDuplicateRows: ReadonlySet<number>,
  existingTags: ExistingTagRef[],
): SelectedImport {
  const existingTagSet = new Set(existingTags.map((t) => t.name.trim().toLowerCase()));
  const newTagsByLower = new Map<string, string>();
  const groups = new Map<string, ImportHouseholdGroup>();
  const orderedGroups: ImportHouseholdGroup[] = [];

  let guestCount = 0;
  let skippedDuplicates = 0;

  for (const row of parsed.validRows) {
    if (row.duplicateOf && !includedDuplicateRows.has(row.rowNumber)) {
      skippedDuplicates++;
      continue;
    }

    guestCount++;
    for (const tag of row.tags) {
      const lower = tag.toLowerCase();
      if (!existingTagSet.has(lower) && !newTagsByLower.has(lower)) {
        newTagsByLower.set(lower, tag);
      }
    }

    const groupKey = row.householdName ? `named:${row.householdName.toLowerCase()}` : `single:${row.rowNumber}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        envelopeName: row.householdName,
        displayLabel: row.householdName ?? `${row.firstName} ${row.lastName}`,
        plusOnesAllowed: row.plusOnesAllowed,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        region: row.region,
        postcode: row.postcode,
        country: row.country,
        notes: row.notes,
        members: [],
      };
      groups.set(groupKey, group);
      orderedGroups.push(group);
    }
    group.members.push(row);
  }

  // Update display labels using householdLabel when envelopeName is null
  for (const g of orderedGroups) {
    if (!g.envelopeName) {
      g.displayLabel = householdLabel(
        { envelopeName: null },
        g.members.map((m, idx) => ({
          id: String(idx),
          householdId: g.key,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          ageGroup: m.ageGroup,
          isPlusOne: false,
          tagIds: [],
        })),
      );
    }
  }

  return {
    households: orderedGroups,
    guestCount,
    skippedDuplicates,
    newTagNames: [...newTagsByLower.values()],
  };
}

// ---------------------------------------------------------------- export

export type ExportHouseholdRow = {
  id: string;
  envelopeName: string | null;
  plusOnesAllowed: number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  notes: string | null;
};

export type ExportGuestRow = SnapGuest & {
  phone: string | null;
};

export type ExportCsvInput = {
  households: ExportHouseholdRow[];
  guests: ExportGuestRow[];
  tags: ExistingTagRef[];
  events: SnapEvent[];
  questions: SnapQuestion[];
  responses: SnapResponse[];
  answers: SnapAnswer[];
};

function makeUniqueHeaders(base: string[]): string[] {
  const seen = new Map<string, number>();
  return base.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });
}

/**
 * Generates the guest list export CSV (one row per guest). Re-importable
 * columns come first with the same header names as import, followed by one
 * column per RSVP event and one column per active question.
 */
export function buildGuestExportCsv(input: ExportCsvInput): string {
  const tagNameById = new Map(input.tags.map((t) => [t.id, t.name]));
  const rsvpEvents = sortByPosition(input.events.filter((e) => e.rsvpEnabled));
  const activeQuestions = sortByPosition(input.questions.filter((q) => !q.archived));
  const respMap = responsesMap(input.responses);

  const guestAnswers = new Map<string, string>();
  const householdAnswers = new Map<string, string>();
  for (const a of input.answers) {
    if (a.guestId) guestAnswers.set(`${a.questionId}:${a.guestId}`, a.value);
    else if (a.householdId) householdAnswers.set(`${a.questionId}:${a.householdId}`, a.value);
  }

  const guestsByHousehold = new Map<string, ExportGuestRow[]>();
  for (const g of input.guests) {
    const list = guestsByHousehold.get(g.householdId);
    if (list) list.push(g);
    else guestsByHousehold.set(g.householdId, [g]);
  }

  // Sort households alphabetically by label for clean export
  const sortedHouseholds = [...input.households].sort((a, b) => {
    const la = householdLabel(a, guestsByHousehold.get(a.id) ?? []);
    const lb = householdLabel(b, guestsByHousehold.get(b.id) ?? []);
    return la.localeCompare(lb, "en-AU");
  });

  const baseHeaders: string[] = [
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
    ...rsvpEvents.map((e) => e.name),
    ...activeQuestions.map((q) => q.label),
  ];

  const headers = makeUniqueHeaders(baseHeaders);
  const dataRows: string[][] = [];

  for (const h of sortedHouseholds) {
    const members = guestsByHousehold.get(h.id) ?? [];
    const label = householdLabel(h, members);
    for (const g of members) {
      const tagNames = g.tagIds
        .map((id) => tagNameById.get(id))
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b, "en-AU"));

      const eventCells = rsvpEvents.map((ev) => {
        const status = guestEventStatus(g, ev, members, respMap);
        return GUEST_EVENT_STATUS_META[status].label;
      });

      const questionCells = activeQuestions.map((q) => {
        const raw =
          q.scope === "household"
            ? householdAnswers.get(`${q.id}:${h.id}`)
            : guestAnswers.get(`${q.id}:${g.id}`);
        if (raw === undefined) return "";
        return answerLabel(q, raw);
      });

      dataRows.push([
        label,
        g.firstName,
        g.lastName,
        g.email ?? "",
        g.phone ?? "",
        g.ageGroup === "child" ? "Yes" : "",
        g.isPlusOne ? "Yes" : "",
        tagNames.join("; "),
        String(h.plusOnesAllowed),
        h.addressLine1 ?? "",
        h.addressLine2 ?? "",
        h.city ?? "",
        h.region ?? "",
        h.postcode ?? "",
        h.country ?? "",
        h.notes ?? "",
        ...eventCells,
        ...questionCells,
      ]);
    }
  }

  // escapeFormulae: guest-typed text like "=HYPERLINK(…)" must not run as a formula in Excel/Sheets.
  return `${Papa.unparse({ fields: headers, data: dataRows }, { escapeFormulae: true })}\r\n`;
}
