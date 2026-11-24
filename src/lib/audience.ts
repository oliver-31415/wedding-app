import type { Audience } from "@/db/schema";

export const EVERYONE: Audience = { mode: "all" };

/** The one rule for "can this guest see / is this guest invited to X". */
export function inAudience(audience: Audience, guestTagIds: Iterable<string>): boolean {
  if (audience.mode === "all") return true;
  if (audience.tagIds.length === 0) return false;
  const wanted = new Set(audience.tagIds);
  for (const id of guestTagIds) if (wanted.has(id)) return true;
  return false;
}

/** Normalise host input: a tag audience with no tags is rejected rather than silently matching nobody. */
export function parseAudience(mode: string, tagIds: string[]): Audience | { error: string } {
  if (mode !== "tags") return EVERYONE;
  const ids = [...new Set(tagIds.filter(Boolean))];
  if (ids.length === 0) return { error: "Choose at least one tag, or pick “Everyone”." };
  return { mode: "tags", tagIds: ids };
}

export function describeAudience(audience: Audience, tagNames: Map<string, string>): string {
  if (audience.mode === "all") return "Everyone";
  const names = audience.tagIds.map((id) => tagNames.get(id)).filter(Boolean);
  return names.length ? `Guests tagged ${names.join(", ")}` : "No one (tags removed)";
}
