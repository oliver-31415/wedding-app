/**
 * The contact details form (/contact/{token}): validating replies and working
 * out what applying one to a household would change. Pure, so the admin can
 * preview a reply against any household before applying it.
 */
import type { ContactAddress, ContactPerson } from "@/db/schema";
import { normalizeName } from "@/lib/rsvp/lookup";

export const MAX_CONTACT_PEOPLE = 6;
const MAX_FIELD = 120;
const MAX_NOTE = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d][\d\s()+-]{5,24}$/;

export const ADDRESS_FIELDS = ["addressLine1", "addressLine2", "city", "region", "postcode", "country"] as const;
export const EMPTY_ADDRESS: ContactAddress = {
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postcode: null,
  country: null,
};

const clean = (v: unknown, max = MAX_FIELD): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

export type RawContactForm = {
  people: { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown }[];
  address: Partial<Record<(typeof ADDRESS_FIELDS)[number], unknown>>;
  note?: unknown;
};

export type ContactFormResult =
  | { ok: true; people: ContactPerson[]; address: ContactAddress; note: string | null }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a shared-link reply. The first person is required (first and last
 * name); further rows are kept only when they have a name. Something useful
 * has to be given: an email, a phone number or an address.
 */
export function validateContactForm(raw: RawContactForm): ContactFormResult {
  const errors: Record<string, string> = {};
  const people: ContactPerson[] = [];
  raw.people.slice(0, MAX_CONTACT_PEOPLE).forEach((p, i) => {
    const person = {
      firstName: clean(p.firstName),
      lastName: clean(p.lastName),
      email: clean(p.email)?.toLowerCase() ?? null,
      phone: clean(p.phone, 30),
    };
    const blank = !person.firstName && !person.lastName && !person.email && !person.phone;
    if (blank && i > 0) return;
    if (!person.firstName) errors[`people.${i}.firstName`] = "Enter a first name.";
    if (!person.lastName) errors[`people.${i}.lastName`] = "Enter a last name.";
    if (person.email && !EMAIL_RE.test(person.email)) errors[`people.${i}.email`] = "Enter a valid email address.";
    if (person.phone && !PHONE_RE.test(person.phone)) errors[`people.${i}.phone`] = "Enter a valid phone number.";
    people.push(person as ContactPerson);
  });
  const address = { ...EMPTY_ADDRESS };
  for (const f of ADDRESS_FIELDS) address[f] = clean(raw.address[f]);
  const hasAddress = ADDRESS_FIELDS.some((f) => address[f]);
  if (!Object.keys(errors).length && !people.some((p) => p.email || p.phone) && !hasAddress) {
    errors.form = "Add an email address, phone number or postal address so there's something to send us.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, people, address, note: clean(raw.note, MAX_NOTE) };
}

export const addressLines = (a: ContactAddress): string[] =>
  [a.addressLine1, a.addressLine2, [a.city, a.region, a.postcode].filter(Boolean).join(" "), a.country].filter(
    (l): l is string => !!l,
  );

// ---------------------------------------------------------------- applying

export type HouseholdMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export type ContactPlan = {
  /** Existing guests whose details change. */
  updates: { guestId: string; name: string; email?: { from: string | null; to: string }; phone?: { from: string | null; to: string } }[];
  /** Existing guests the reply named without changing anything. */
  unchanged: { guestId: string; name: string }[];
  /** People not found in the household; applying adds them as guests. */
  additions: ContactPerson[];
  address: { from: string[]; to: string[] } | null;
};

/** Which household member a submitted person is: same full name, else a unique first name. */
export function matchMember(person: Pick<ContactPerson, "firstName" | "lastName">, members: HouseholdMember[]): HouseholdMember | null {
  const first = normalizeName(person.firstName);
  const full = `${first} ${normalizeName(person.lastName)}`;
  const exact = members.filter((m) => `${normalizeName(m.firstName)} ${normalizeName(m.lastName)}` === full);
  if (exact.length === 1) return exact[0];
  const byFirst = members.filter((m) => normalizeName(m.firstName) === first);
  return byFirst.length === 1 ? byFirst[0] : null;
}

/**
 * What applying a reply to a household would do: fill in or change emails
 * and phone numbers (blank fields never erase anything), add people who
 * aren't on the list yet, and replace the postal address if one was given.
 */
export function planContactApply(
  reply: { people: ContactPerson[]; address: ContactAddress },
  members: HouseholdMember[],
  currentAddress: ContactAddress,
): ContactPlan {
  const plan: ContactPlan = { updates: [], unchanged: [], additions: [], address: null };
  const used = new Set<string>();
  for (const person of reply.people) {
    const member = matchMember(person, members.filter((m) => !used.has(m.id)));
    if (!member) {
      plan.additions.push(person);
      continue;
    }
    used.add(member.id);
    const name = `${member.firstName} ${member.lastName}`;
    const update: ContactPlan["updates"][number] = { guestId: member.id, name };
    if (person.email && person.email !== member.email?.toLowerCase()) update.email = { from: member.email, to: person.email };
    if (person.phone && person.phone !== member.phone) update.phone = { from: member.phone, to: person.phone };
    if (update.email || update.phone) plan.updates.push(update);
    else plan.unchanged.push({ guestId: member.id, name });
  }
  const to = addressLines(reply.address);
  const from = addressLines(currentAddress);
  if (to.length && to.join("\n") !== from.join("\n")) plan.address = { from, to };
  return plan;
}

export const planIsEmpty = (p: ContactPlan) => !p.updates.length && !p.additions.length && !p.address;
