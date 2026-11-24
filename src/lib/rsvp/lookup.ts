/**
 * Finding a guest's invitation from the name they type on the RSVP page.
 * Deliberately conservative: an exact name match logs them straight in; a
 * near match only offers a short list to confirm, labelled with just the
 * matched person's name, so nobody can browse the guest list by guessing.
 */
import { guestName, type SnapGuest } from "./model";

const TRANSLIT: Record<string, string> = { ø: "o", ß: "ss", ł: "l", æ: "ae", œ: "oe", đ: "d", þ: "th" };
const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "prof", "sir", "dame", "rev"]);

export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[øßłæœđþ]/g, (c) => TRANSLIT[c])
    .replace(/[’'`.]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNameKey(s: string): string {
  const words = normalizeName(s).split(" ").filter((w) => !HONORIFICS.has(w));
  return words[0] ?? "";
}

/** "Mc Donald" = "McDonald", "O Brien" = "O'Brien", "De Luca" = "DeLuca". */
function surnameKey(s: string): string {
  return normalizeName(s).replace(/ /g, "");
}

function surnameParts(s: string): string[] {
  return normalizeName(s).split(" ").filter((w) => w.length >= 2);
}

/** Common short forms. Each group is interchangeable. */
const NICKNAMES = [
  ["william", "will", "bill", "billy", "liam"],
  ["robert", "rob", "robbie", "bob", "bobby"],
  ["catherine", "katherine", "kathryn", "kate", "katie", "cate", "kath", "kathy"],
  ["elizabeth", "liz", "lizzie", "beth", "betty", "eliza", "libby"],
  ["rebecca", "bec", "becca", "becky"],
  ["lachlan", "lachie", "lachy"],
  ["alexander", "alex", "xander", "sandy"],
  ["alexandra", "alex", "lexie", "sandra"],
  ["james", "jim", "jimmy", "jamie"],
  ["michael", "mike", "mick", "mikey"],
  ["christopher", "chris", "topher"],
  ["christine", "christina", "chris", "tina"],
  ["matthew", "matt", "matty"],
  ["nicholas", "nick", "nicky"],
  ["benjamin", "ben", "benji"],
  ["thomas", "tom", "tommy"],
  ["daniel", "dan", "danny"],
  ["jonathan", "jon", "jonny"],
  ["john", "jack", "johnny"],
  ["margaret", "maggie", "meg", "peggy", "marg"],
  ["jennifer", "jen", "jenny"],
  ["samuel", "sam", "sammy"],
  ["samantha", "sam", "sammy"],
  ["joseph", "joe", "joey"],
  ["richard", "rick", "ricky", "dick", "rich"],
  ["edward", "ed", "eddie", "ted", "ned"],
  ["anthony", "tony", "ant"],
  ["patrick", "pat", "paddy"],
  ["patricia", "pat", "trish", "patty"],
  ["victoria", "vic", "tori", "vicky"],
  ["stephanie", "steph"],
  ["stephen", "steven", "steve"],
  ["timothy", "tim", "timmy"],
  ["andrew", "andy", "drew"],
  ["david", "dave", "davo"],
];

function sameFirstName(typed: string, stored: string): boolean {
  if (typed === stored) return true;
  return NICKNAMES.some((group) => group.includes(typed) && group.includes(stored));
}

export type LookupResult =
  | { kind: "match"; householdId: string }
  | { kind: "choose"; options: { householdId: string; label: string }[] }
  | { kind: "none" }
  | { kind: "too_many" };

const MAX_CHOICES = 4;
const MIN_PREFIX = 3;

export function findInvitation(firstName: string, lastName: string, guests: SnapGuest[]): LookupResult {
  const first = firstNameKey(firstName);
  const last = surnameKey(lastName);
  if (!first || !last) return { kind: "none" };

  const exact = guests.filter((g) => firstNameKey(g.firstName) === first && surnameKey(g.lastName) === last);
  const exactHouseholds = uniqueHouseholds(exact);
  if (exactHouseholds.length === 1) return { kind: "match", householdId: exactHouseholds[0] };
  if (exactHouseholds.length > 1) return choices(exact);

  // Near matches, offered to confirm (never an automatic login):
  //  - same surname and a nickname or a prefix of at least 3 letters ("Rob" / "Robert", "Bec" / "Rebecca");
  //  - one part of a double-barrelled surname ("Smith" for "Smith-Jones");
  //  - first and last name swapped.
  const typedParts = surnameParts(lastName);
  const near = guests.filter((g) => {
    const gf = firstNameKey(g.firstName);
    const gl = surnameKey(g.lastName);
    if (gf === surnameKey(lastName) && gl === surnameKey(firstName)) return true;
    const surnameOk =
      gl === last || (surnameParts(g.lastName).length > 1 && typedParts.some((p) => surnameParts(g.lastName).includes(p)));
    if (!surnameOk) return false;
    if (sameFirstName(first, gf)) return true;
    const shorter = Math.min(gf.length, first.length);
    return shorter >= MIN_PREFIX && (gf.startsWith(first) || first.startsWith(gf));
  });
  if (near.length === 0) return { kind: "none" };
  return choices(near);
}

function uniqueHouseholds(matches: SnapGuest[]): string[] {
  return [...new Set(matches.map((g) => g.householdId))];
}

/** One option per household, labelled with only the matched person's name. */
function choices(matches: SnapGuest[]): LookupResult {
  const byHousehold = new Map<string, SnapGuest>();
  for (const g of matches) if (!byHousehold.has(g.householdId)) byHousehold.set(g.householdId, g);
  if (byHousehold.size > MAX_CHOICES) return { kind: "too_many" };
  return {
    kind: "choose",
    options: [...byHousehold].map(([householdId, g]) => ({ householdId, label: guestName(g) })),
  };
}
