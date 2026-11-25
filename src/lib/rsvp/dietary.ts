/**
 * Dietary requirements: a question type with a fixed list guests tick (as many
 * as apply) plus an optional note for anything else. Stored in `answers.value`
 * as JSON, e.g. {"needs":["vegetarian","gluten_free"],"note":"no mushrooms"};
 * {"needs":[]} means "no dietary requirements". A wedding has at most one
 * active dietary question, so the totals and chart have a single source.
 */

export const DIETARY_NEEDS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "gluten_free", label: "Gluten free" },
  // Coeliac is its own tick: kitchens handle cross-contamination very differently from a preference.
  { id: "coeliac", label: "Coeliac" },
  { id: "dairy_free", label: "Dairy free" },
  { id: "nut_allergy", label: "Nut allergy" },
  { id: "egg_allergy", label: "Egg allergy" },
  { id: "shellfish_allergy", label: "Seafood or shellfish allergy" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
] as const;

export type DietaryNeed = (typeof DIETARY_NEEDS)[number]["id"];
export type DietaryAnswer = { needs: DietaryNeed[]; note: string | null };

export const MAX_DIETARY_NOTE = 300;
export const DEFAULT_DIETARY_LABEL = "Any dietary requirements?";

const LABELS = new Map<string, string>(DIETARY_NEEDS.map((n) => [n.id, n.label]));
const ORDER = new Map<string, number>(DIETARY_NEEDS.map((n, i) => [n.id, i]));

export const dietaryNeedLabel = (id: DietaryNeed) => LABELS.get(id) ?? id;

/** A stored or submitted value; null if it isn't a dietary answer. */
export function parseDietary(raw: string, opts: { keepSpaces?: boolean } = {}): DietaryAnswer | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const { needs, note } = data as { needs?: unknown; note?: unknown };
  if (!Array.isArray(needs) || !needs.every((n) => typeof n === "string" && LABELS.has(n))) return null;
  if (note != null && typeof note !== "string") return null;
  // Only a missing note means "none": a blank one would otherwise turn into it on saving.
  if (!opts.keepSpaces && needs.length === 0 && typeof note === "string" && !note.trim()) return null;
  const unique = [...new Set(needs as DietaryNeed[])].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
  return { needs: unique, note: (opts.keepSpaces ? note : note?.trim()) || null };
}

/** The canonical stored form; "" (unanswered) when nothing is ticked or typed and "none" wasn't chosen. */
export function encodeDietary(answer: DietaryAnswer): string {
  const needs = [...new Set(answer.needs)].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
  const note = answer.note?.trim() || null;
  return JSON.stringify(note ? { needs, note } : { needs });
}

export const NO_DIETARY_NEEDS = encodeDietary({ needs: [], note: null });

export const hasNoNeeds = (a: DietaryAnswer) => a.needs.length === 0 && !a.note;

/** "Vegetarian, gluten free (no mushrooms)" / "None". */
export function describeDietary(a: DietaryAnswer): string {
  if (hasNoNeeds(a)) return "None";
  const needs = a.needs.map((n, i) => (i === 0 ? dietaryNeedLabel(n) : dietaryNeedLabel(n).toLowerCase())).join(", ");
  if (!needs) return a.note!;
  return a.note ? `${needs} (${a.note})` : needs;
}

/**
 * The slice of the chart a person falls in: their exact combination of needs,
 * so slices never overlap and the caterer sees "Vegan + gluten free" as its
 * own count. A note on its own is "Other (see note)".
 */
export function dietaryGroup(a: DietaryAnswer): { key: string; label: string } {
  if (a.needs.length === 0) return a.note ? { key: "other", label: "Other (see note)" } : { key: "none", label: "No requirements" };
  return {
    key: a.needs.join("+"),
    label: a.needs.map((n, i) => (i === 0 ? dietaryNeedLabel(n) : dietaryNeedLabel(n).toLowerCase())).join(" + "),
  };
}

/**
 * One change on the form, from the current value to the next. Ticking
 * "No dietary requirements" clears the rest; ticking a need clears "none";
 * unticking everything (with no note) leaves the question unanswered ("").
 * Spaces in the note are kept while typing; saving tidies them.
 */
export function editDietary(
  raw: string,
  change: { none: boolean } | { need: DietaryNeed; on: boolean } | { note: string },
): string {
  const current = (raw && parseDietary(raw, { keepSpaces: true })) || { needs: [], note: null };
  let next: DietaryAnswer;
  if ("none" in change) return change.none ? NO_DIETARY_NEEDS : "";
  if ("need" in change) {
    const needs = change.on ? [...current.needs, change.need] : current.needs.filter((n) => n !== change.need);
    next = { needs, note: current.note };
  } else {
    next = { needs: current.needs, note: change.note || null };
  }
  if (next.needs.length === 0 && !next.note?.trim()) return "";
  const needs = [...new Set(next.needs)].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
  return JSON.stringify(next.note ? { needs, note: next.note } : { needs });
}
