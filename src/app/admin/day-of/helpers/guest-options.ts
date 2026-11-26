import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { GuestOption } from "@/components/admin/day-of/helper-form";

/** The guest list for "Fill in from your guest list" (host only: includes email and phone). */
export async function guestOptions(weddingId: string): Promise<GuestOption[]> {
  const rows = await db
    .select({
      id: schema.guests.id,
      firstName: schema.guests.firstName,
      lastName: schema.guests.lastName,
      email: schema.guests.email,
      phone: schema.guests.phone,
    })
    .from(schema.guests)
    .where(eq(schema.guests.weddingId, weddingId))
    .orderBy(asc(schema.guests.firstName), asc(schema.guests.lastName));
  return rows.map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName}`.trim(), email: g.email, phone: g.phone }));
}

/** Where to go after saving: back to the run sheet if you came from there, else the helpers list. */
export const RETURN_PATHS = ["/admin/day-of", "/admin/day-of/helpers"] as const;
export function returnPath(raw: string | string[] | null | undefined): (typeof RETURN_PATHS)[number] {
  return RETURN_PATHS.find((p) => p === raw) ?? "/admin/day-of/helpers";
}
