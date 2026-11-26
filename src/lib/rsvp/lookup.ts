/**
 * Finding a guest's invitation from the name they type on the RSVP page.
 * Deliberately conservative, in three tiers:
 *
 *  1. Exact (ignoring case, accents, punctuation and honorifics), or exactly a
 *     name the couple accepted before on Name checks (an alias): logs them in.
 *  2. Confident near match: a nickname or shortened first name, part of a
 *     double-barrelled surname, first and last swapped, or a single typo in a
 *     name long enough for one letter to be telling ("Rebbeca", "Smtih").
 *     Only offered as "Is this you?", labelled with just the matched
 *     person's name, so nobody can browse the guest list by guessing.
 *  3. Unsure (two typos, sounds alike, a one-letter difference in a short
 *     name, the same first name with a different surname, …): the guest sees
 *     nothing and can ask the couple to check. `suggestGuests` shows these to
 *     the couple, with a plain reason, so they can decide.
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

/**
 * The whole first name, without honorifics: "Mary-Anne" is "mary anne", so
 * Mary-Anne and Mary-Jane are never the same name (sharing "Mary" only makes
 * them a near match, see compareFirst).
 */
function firstNameKey(s: string): string {
  return normalizeName(s)
    .split(" ")
    .filter((w) => !HONORIFICS.has(w))
    .join(" ");
}

/** "Mc Donald" = "McDonald", "O Brien" = "O'Brien", "De Luca" = "DeLuca". */
function surnameKey(s: string): string {
  return normalizeName(s).replace(/ /g, "");
}

/** Particles that start many surnames; on their own they say nothing about who someone is. */
const PARTICLES = new Set(["de", "da", "di", "du", "del", "della", "la", "le", "van", "von", "der", "den", "ten", "st", "mc", "mac", "el", "al", "bin", "ben", "dos", "das"]);

/** The parts of a double-barrelled surname that can identify someone ("smith", "jones"). */
function surnameParts(s: string): string[] {
  return normalizeName(s)
    .split(" ")
    .filter((w) => w.length >= 3 && !PARTICLES.has(w));
}

/** A typed surname longer than this many words isn't a real double-barrelled name. */
const MAX_SURNAME_WORDS = 3;

/** The key two typed names are compared by: same key = the same name. */
export function nameKey(firstName: string, lastName: string): string {
  return `${firstNameKey(firstName)}|${surnameKey(lastName)}`;
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

// ------------------------------------------------------------ spelling

/**
 * Damerau–Levenshtein distance (the "optimal string alignment" form): the
 * fewest single-letter insertions, deletions, substitutions or swaps of two
 * neighbouring letters that turn `a` into `b`. "smtih" → "smith" is 1.
 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
    }
    prev2 = prev;
    prev = row;
  }
  return prev[n];
}

/** "rebbeca" → "rebeca": doubled letters count once. */
const squash = (s: string) => s.replace(/(.)\1+/g, "$1");

function isSwap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

type Spelling = { edits: number; detail: "swap" | "double" | "letter" };

function spelling(a: string, b: string): Spelling {
  if (a === b) return { edits: 0, detail: "letter" };
  if (squash(a) === squash(b)) return { edits: 1, detail: "double" };
  const d = Math.min(editDistance(a, b), editDistance(squash(a), squash(b)) + 1);
  return { edits: d, detail: d === 1 && isSwap(a, b) ? "swap" : "letter" };
}

/**
 * A simple sounds-alike key: a few English spelling rules ("ph" = "f",
 * soft "c" = "s", "y" = "i", silent "gh" …), then Soundex-style consonant
 * groups without truncation. The first letter is kept, so "Sam" ≠ "Pam".
 */
export function soundKey(s: string): string {
  const w = s
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/^kn/, "n")
    .replace(/^wr/, "r")
    .replace(/^ps/, "s")
    .replace(/^x/, "s")
    .replace(/ph/g, "f")
    .replace(/gh/g, "")
    .replace(/ck/g, "k")
    .replace(/sch/g, "sk")
    .replace(/tch/g, "ch")
    .replace(/dg/g, "j")
    .replace(/th/g, "t")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/y/g, "i");
  if (!w) return "";
  const code = (c: string) =>
    "bfpv".includes(c) ? "1" : "cgjkqsxz".includes(c) ? "2" : "dt".includes(c) ? "3" : c === "l" ? "4" : "mn".includes(c) ? "5" : c === "r" ? "6" : "aeiou".includes(c) ? "0" : "";
  let key = "aeiou".includes(w[0]) ? "a" : w[0];
  let last = code(w[0]);
  for (const c of w.slice(1)) {
    const k = code(c);
    if (k === "") continue; // h, w: no sound of their own, don't separate
    if (k !== last && k !== "0") key += k;
    last = k;
  }
  return key;
}

// ------------------------------------------------------------ comparing parts

type PartMatch =
  | { kind: "exact" | "nickname" | "prefix" | "part" | "sound" | "otherpart" | "none" }
  /** typo: one letter in a name long enough to trust; close: anything else within two letters. */
  | { kind: "typo" | "close"; detail: Spelling["detail"]; edits: number };

const MIN_PREFIX = 3;

function bySpelling(a: string, b: string): PartMatch | null {
  const s = spelling(a, b);
  const shorter = Math.min(a.length, b.length);
  // Short names need stricter rules: "Sam" / "Pam" are different people,
  // and in four letters only a swap or a doubled letter is trusted ("Jhon").
  const confident = s.edits === 1 && (shorter >= 5 || (shorter === 4 && s.detail !== "letter"));
  if (confident) return { kind: "typo", ...s };
  if ((s.edits === 1 && shorter >= 3) || (s.edits === 2 && shorter >= 6)) return { kind: "close", ...s };
  return null;
}

function bySound(a: string, b: string): PartMatch | null {
  return Math.min(a.length, b.length) >= 3 && soundKey(a) === soundKey(b) ? { kind: "sound" } : null;
}

function compareFirst(typed: string, stored: string): PartMatch {
  if (typed === stored) return { kind: "exact" };
  const typedWords = typed.split(" ");
  const storedWords = stored.split(" ");
  // Compound first names: "Mary" for "Mary-Jane" is the name shortened, but
  // "Mary-Anne" for "Mary-Jane" is likely someone else, so only the couple sees it.
  if (typedWords.length > 1 || storedWords.length > 1) {
    if (typedWords[0] === storedWords[0]) {
      return typedWords.length === 1 || storedWords.length === 1 ? { kind: "prefix" } : { kind: "otherpart" };
    }
  }
  if (sameFirstName(typed, stored) || sameFirstName(typedWords[0], storedWords[0])) return { kind: "nickname" };
  const shorter = Math.min(typed.length, stored.length);
  if (shorter >= MIN_PREFIX && (stored.startsWith(typed) || typed.startsWith(stored))) return { kind: "prefix" };
  return bySpelling(typed, stored) ?? bySound(typed, stored) ?? { kind: "none" };
}

function compareLast(typedRaw: string, storedRaw: string): PartMatch {
  const typed = surnameKey(typedRaw);
  const stored = surnameKey(storedRaw);
  if (typed === stored) return { kind: "exact" };
  // One half of a double-barrelled surname, either way round ("Smith" / "Smith-Jones").
  // Only for realistic inputs, so a long list of surnames can't be tested in one go.
  const storedParts = surnameParts(storedRaw);
  const typedParts = surnameParts(typedRaw);
  const typedWords = normalizeName(typedRaw).split(" ").length;
  if (typedWords <= MAX_SURNAME_WORDS) {
    if (storedParts.length > 1 && typedParts.some((p) => storedParts.includes(p))) return { kind: "part" };
    if (typedParts.length > 1 && typedParts.includes(stored)) return { kind: "part" };
  }
  return bySpelling(typed, stored) ?? bySound(typed, stored) ?? { kind: "none" };
}

// ------------------------------------------------------------ scoring

export type MatchTier = "exact" | "confident" | "unsure";

export type NameAlias = { firstName: string; lastName: string; guestId: string | null };

export type GuestSuggestion = {
  guest: SnapGuest;
  tier: MatchTier;
  /** Higher is closer. Only for ordering. */
  score: number;
  /** Plain words for the couple, e.g. "One letter different in the surname". */
  reason: string;
};

const PART_SCORE: Record<PartMatch["kind"], number> = {
  exact: 50,
  nickname: 44,
  prefix: 40,
  part: 40,
  otherpart: 30,
  typo: 42,
  close: 30,
  sound: 28,
  none: 0,
};

function phrase(m: PartMatch, which: "first name" | "surname"): string | null {
  switch (m.kind) {
    case "exact":
      return null;
    case "nickname":
      return "a nickname for the first name";
    case "prefix":
      return "the first name shortened";
    case "part":
      return "part of a double-barrelled surname";
    case "otherpart":
      return "the first name starts the same";
    case "sound":
      return `the ${which} sounds the same`;
    case "none":
      return `a different ${which}`;
    case "typo":
    case "close":
      if (m.detail === "swap") return `two letters swapped in the ${which}`;
      if (m.detail === "double") return `a letter doubled differently in the ${which}`;
      return m.edits === 1 ? `one letter different in the ${which}` : `two letters different in the ${which}`;
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Typed = { first: string; last: string; lastRaw: string; firstRaw: string };

function scoreGuest(t: Typed, g: SnapGuest): Omit<GuestSuggestion, "guest"> | null {
  const gf = firstNameKey(g.firstName);
  const gl = surnameKey(g.lastName);
  if (!gf && !gl) return null;
  const f = compareFirst(t.first, gf);
  const l = compareLast(t.lastRaw, g.lastName);

  if (f.kind === "exact" && l.kind === "exact") return { tier: "exact", score: 100, reason: "Same name" };
  if (gf === surnameKey(t.lastRaw) && gl === surnameKey(t.firstRaw)) {
    return { tier: "confident", score: 80, reason: "First and last name swapped" };
  }

  const firstStrong = f.kind === "exact" || f.kind === "nickname";
  const confident =
    ((firstStrong || f.kind === "prefix") && l.kind === "exact") ||
    (firstStrong && l.kind === "part") ||
    (firstStrong && l.kind === "typo") ||
    (f.kind === "typo" && l.kind === "exact");

  if (f.kind === "none" || l.kind === "none") {
    // Only one half matches: worth showing the couple (a married name, a
    // sibling), never the guest.
    if (firstStrong && l.kind === "none") return { tier: "unsure", score: 20, reason: "Same first name" };
    if (l.kind === "exact" && f.kind === "none") return { tier: "unsure", score: 15, reason: "Same surname" };
    return null;
  }

  const score = PART_SCORE[f.kind] + PART_SCORE[l.kind];
  let reason: string;
  if (f.kind === "sound" && l.kind === "sound") reason = "Sounds the same";
  else if ((f.kind === "typo" || f.kind === "close") && (l.kind === "typo" || l.kind === "close")) {
    reason = f.edits === 1 && l.edits === 1 ? "One letter different in each name" : "A letter or two different in each name";
  } else {
    reason = capitalise([phrase(f, "first name"), phrase(l, "surname")].filter(Boolean).join(", and "));
  }
  return { tier: confident ? "confident" : "unsure", score, reason };
}

function typedName(firstName: string, lastName: string): Typed | null {
  const first = firstNameKey(firstName);
  const last = surnameKey(lastName);
  if (!first || !last) return null;
  return { first, last, firstRaw: firstName, lastRaw: lastName };
}

/** Guests the couple accepted this exact typed name for before. */
function aliasGuests(t: Typed, guests: SnapGuest[], aliases: NameAlias[]): SnapGuest[] {
  const key = `${t.first}|${t.last}`;
  const ids = new Set(aliases.filter((a) => a.guestId && nameKey(a.firstName, a.lastName) === key).map((a) => a.guestId));
  return guests.filter((g) => ids.has(g.id));
}

/**
 * The guests closest to a typed name, best first, for the couple to choose
 * from on Name checks. Includes unsure matches; never shown to guests.
 */
export function suggestGuests(
  firstName: string,
  lastName: string,
  guests: SnapGuest[],
  limit = 5,
  aliases: NameAlias[] = [],
): GuestSuggestion[] {
  const t = typedName(firstName, lastName);
  if (!t) return [];
  const aliased = new Set(aliasGuests(t, guests, aliases).map((g) => g.id));
  const out: GuestSuggestion[] = [];
  for (const g of guests) {
    if (aliased.has(g.id)) {
      out.push({ guest: g, tier: "exact", score: 100, reason: "You matched this name to them before" });
      continue;
    }
    const s = scoreGuest(t, g);
    if (s) out.push({ guest: g, ...s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ------------------------------------------------------------ guest lookup

export type LookupResult =
  | { kind: "match"; householdId: string }
  | { kind: "choose"; options: { householdId: string; label: string }[] }
  | { kind: "none" }
  | { kind: "too_many" };

const MAX_CHOICES = 4;

export function findInvitation(
  firstName: string,
  lastName: string,
  guests: SnapGuest[],
  /** Names the couple accepted on Name checks (`name_requests` with status "accepted"). */
  aliases: NameAlias[] = [],
): LookupResult {
  const t = typedName(firstName, lastName);
  if (!t) return { kind: "none" };

  const exact = [
    ...guests.filter((g) => firstNameKey(g.firstName) === t.first && surnameKey(g.lastName) === t.last),
    ...aliasGuests(t, guests, aliases),
  ];
  const exactHouseholds = uniqueHouseholds(exact);
  if (exactHouseholds.length === 1) return { kind: "match", householdId: exactHouseholds[0] };
  if (exactHouseholds.length > 1) return choices(exact);

  // Confident near matches are offered to confirm, never an automatic login.
  const near = guests
    .map((g) => ({ g, s: scoreGuest(t, g) }))
    .filter((x) => x.s?.tier === "confident")
    .sort((a, b) => b.s!.score - a.s!.score)
    .map((x) => x.g);
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
