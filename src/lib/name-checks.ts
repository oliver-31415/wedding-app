import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NameAlias } from "@/lib/rsvp/lookup";

/**
 * Name checks: a guest who can't find their invitation asks the couple to
 * check their name (`name_requests`). Accepted requests double as aliases, so
 * the same typed name finds that guest's household straight away next time.
 */

/** Most pending requests a wedding can have at once (stops a flood from the public form). */
export const MAX_PENDING_NAME_CHECKS = 100;
export const MAX_NAME_CHECK_NOTE = 1000;
export const MAX_NAME_CHECK_EMAIL = 200;

export const NAME_CHECKS_PATH = "/admin/rsvp/name-checks";

/** Names the couple accepted, for `findInvitation` / `suggestGuests`. */
export async function loadNameAliases(weddingId: string): Promise<NameAlias[]> {
  return db
    .select({
      firstName: schema.nameRequests.firstName,
      lastName: schema.nameRequests.lastName,
      guestId: schema.nameRequests.guestId,
    })
    .from(schema.nameRequests)
    .where(
      and(
        eq(schema.nameRequests.weddingId, weddingId),
        eq(schema.nameRequests.status, "accepted"),
        isNotNull(schema.nameRequests.guestId),
      ),
    );
}

export async function countPendingNameChecks(weddingId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.nameRequests)
    .where(and(eq(schema.nameRequests.weddingId, weddingId), eq(schema.nameRequests.status, "pending")));
  return Number(row?.n ?? 0);
}

/** Email addresses of the owner and co-hosts. */
export async function hostEmails(weddingId: string): Promise<string[]> {
  const rows = await db
    .select({ email: schema.users.email })
    .from(schema.weddingMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.weddingMembers.userId))
    .where(eq(schema.weddingMembers.weddingId, weddingId));
  return [...new Set(rows.map((r) => r.email))];
}
