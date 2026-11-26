import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { describeWhen, emailLimits, limitReached, MONTH_MS, nextRoomAt, usage, type SendKind } from "@/lib/email-quota";
import { newId } from "@/lib/ids";

/**
 * Reads and records `email_sends` (see src/lib/email-quota.ts for the rules).
 * Counted across all weddings: they share one email account.
 */

/** Send times (unix ms) that still count against the limits. */
export async function recentSends(now = Date.now()): Promise<number[]> {
  const rows = await db
    .select({ at: schema.emailSends.createdAt })
    .from(schema.emailSends)
    .where(gt(schema.emailSends.createdAt, new Date(now - MONTH_MS)));
  return rows.map((r) => r.at.getTime());
}

/** Emails sent in the last 24 hours and 31 days, with the limits and the time it was measured. */
export async function emailUsage(now = Date.now()) {
  const limits = emailLimits();
  const sends = await recentSends(now);
  return { ...usage(sends, now), limits, sends, now };
}

export type Reservation = { ok: true; id: string } | { ok: false; error: string; retryAt: number | null };

const DEFAULT_TIME_ZONE = "Australia/Sydney";

async function timeZoneOf(weddingId: string | null | undefined): Promise<string> {
  if (!weddingId) return DEFAULT_TIME_ZONE;
  const [w] = await db
    .select({ timeZone: schema.weddings.timeZone })
    .from(schema.weddings)
    .where(eq(schema.weddings.id, weddingId));
  return w?.timeZone ?? DEFAULT_TIME_ZONE;
}

/**
 * Checks the limits and records one send in a single write transaction, so
 * two emails going at once can't both take the last slot. Bulk sends must
 * leave the reserve free. Undo with `releaseSend` if the email didn't go.
 */
export async function reserveSend(weddingId: string | null | undefined, kind: SendKind): Promise<Reservation> {
  const limits = emailLimits();
  type Outcome = { id: string } | { id?: undefined; reached: "daily" | "monthly"; retryAt: number | null; now: number };
  const result = await db.transaction(
    async (tx): Promise<Outcome> => {
      const now = Date.now();
      const rows = await tx
        .select({ at: schema.emailSends.createdAt })
        .from(schema.emailSends)
        .where(gt(schema.emailSends.createdAt, new Date(now - MONTH_MS)));
      const sends = rows.map((r) => r.at.getTime());
      const reached = limitReached(sends, now, limits, kind);
      if (reached) return { reached, retryAt: nextRoomAt(sends, now, limits, kind), now };
      const id = newId();
      await tx.insert(schema.emailSends).values({ id, weddingId: weddingId ?? null, createdAt: new Date(now) });
      return { id };
    },
    { behavior: "immediate" },
  );
  if (result.id !== undefined) return { ok: true, id: result.id };

  const when = result.retryAt ? describeWhen(result.retryAt, result.now, await timeZoneOf(weddingId)) : null;
  const again = when ? ` Emails can go again from ${when}.` : "";
  const error =
    result.reached === "daily"
      ? `Today's email limit (${kind === "bulk" ? limits.daily - limits.bulkReserve : limits.daily}) is used up.${again}`
      : `This month's email limit (${kind === "bulk" ? limits.monthly - limits.bulkReserve : limits.monthly}) is used up.${again}`;
  return { ok: false, error, retryAt: result.retryAt };
}

/** Forgets a reserved send whose email didn't go. */
export async function releaseSend(id: string): Promise<void> {
  await db.delete(schema.emailSends).where(eq(schema.emailSends.id, id));
}

/** Deletes send records too old to count (kept a little longer than the monthly window). */
export async function pruneSends(now = Date.now()): Promise<void> {
  await db.delete(schema.emailSends).where(lt(schema.emailSends.createdAt, new Date(now - 2 * MONTH_MS)));
}

/** Queued email deliveries across all weddings, optionally only those queued before `before`. */
export async function queuedCount(before?: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.messageDeliveries)
    .where(
      and(
        eq(schema.messageDeliveries.status, "queued"),
        before ? lt(schema.messageDeliveries.createdAt, before) : undefined,
      ),
    );
  return Number(row?.n ?? 0);
}
