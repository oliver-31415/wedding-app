import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DeliveryMethod } from "@/db/schema";
import { newId } from "@/lib/ids";
import type { ManualMethod } from "@/lib/messaging/delivery-methods";
import { selectRecipients } from "@/lib/messaging/recipients";
import type { WeddingSnapshot } from "@/lib/stats";

/**
 * Who a sent message has reached. Emails are recorded when they're sent; for
 * guests without an email address (or added since) the couple records how
 * they passed it on — posted, texted, in person — so everyone the message was
 * meant for ends up counted the same way.
 */

type Message = typeof schema.messages.$inferSelect;

export type Delivery = {
  id: string;
  guestId: string | null;
  email: string | null;
  method: DeliveryMethod;
  /** "queued": an email waiting for room under the email limits (src/lib/messaging/queue.ts). */
  status: "queued" | "sent" | "failed";
};

/**
 * Why a guest the message is meant for hasn't got it: no address; added to
 * the list after it went; their email failed; or not emailed (the couple
 * stopped the rest of a send, or the address was added since).
 */
export type NotReachedReason = "no_email" | "added_since" | "failed" | "not_emailed";
export type NotReached = { guestId: string; householdId: string; name: string; reason: NotReachedReason };

export const NOT_REACHED_REASON: Record<NotReachedReason, string> = {
  no_email: "no email",
  added_since: "added since",
  failed: "email failed",
  not_emailed: "not emailed",
};

export async function deliveriesFor(weddingId: string, messageIds: string[]): Promise<(Delivery & { messageId: string })[]> {
  if (!messageIds.length) return [];
  return db
    .select({
      id: schema.messageDeliveries.id,
      messageId: schema.messageDeliveries.messageId,
      guestId: schema.messageDeliveries.guestId,
      email: schema.messageDeliveries.email,
      method: schema.messageDeliveries.method,
      status: schema.messageDeliveries.status,
    })
    .from(schema.messageDeliveries)
    .where(and(eq(schema.messageDeliveries.weddingId, weddingId), inArray(schema.messageDeliveries.messageId, messageIds)))
    .orderBy(asc(schema.messageDeliveries.createdAt));
}

/**
 * Guests the message is meant for (by its recipient filter, as the guest list
 * is now) who have no successful delivery and no email waiting to send: no
 * email address, added after it went out, or their email failed or was
 * stopped. Someone who shares an address that was emailed counts as reached.
 * Pass `addedAt` (guest id → when they were added) to tell "added since" apart
 * from "not emailed"; without it, both read as "added since".
 */
export function notReached(
  snapshot: WeddingSnapshot,
  message: Pick<Message, "recipients"> & { sentAt?: Date | null },
  deliveries: Delivery[],
  addedAt?: Map<string, Date>,
): NotReached[] {
  const preview = selectRecipients(snapshot, message.recipients);
  // Waiting to send counts as on its way: not reached, but nothing for the couple to do.
  const covered = deliveries.filter((d) => d.status === "sent" || d.status === "queued");
  const reachedGuests = new Set(covered.filter((d) => d.guestId).map((d) => d.guestId!));
  const reachedEmails = new Set(covered.filter((d) => d.email).map((d) => d.email!.toLowerCase()));
  const failedGuests = new Set(deliveries.filter((d) => d.status === "failed" && d.guestId).map((d) => d.guestId!));
  const byId = new Map(snapshot.guests.map((g) => [g.id, g]));
  const out: NotReached[] = [];
  for (const m of preview.missingEmail) {
    const g = byId.get(m.guestId);
    if (g && !reachedGuests.has(g.id)) out.push({ guestId: g.id, householdId: g.householdId, name: m.name, reason: "no_email" });
  }
  for (const r of preview.recipients) {
    if (reachedGuests.has(r.guestId) || reachedEmails.has(r.email)) continue;
    const g = byId.get(r.guestId)!;
    const added = addedAt?.get(g.id);
    const reason: NotReachedReason = failedGuests.has(g.id)
      ? "failed"
      : !addedAt || !message.sentAt || (added && added > message.sentAt)
        ? "added_since"
        : "not_emailed";
    out.push({ guestId: g.id, householdId: g.householdId, name: `${g.firstName} ${g.lastName}`, reason });
  }
  return out;
}

/** Deliveries still waiting to send. */
export const waitingToSend = <D extends Pick<Delivery, "status">>(deliveries: D[]) => deliveries.filter((d) => d.status === "queued");

/** Records that these guests got the message another way. Guests already reached are skipped. */
export async function markReached(weddingId: string, messageId: string, guestIds: string[], method: ManualMethod): Promise<number> {
  return db.transaction(
    async (tx) => {
      const [message] = await tx
        .select({ id: schema.messages.id })
        .from(schema.messages)
        .where(and(eq(schema.messages.id, messageId), eq(schema.messages.weddingId, weddingId), eq(schema.messages.status, "sent")));
      if (!message || !guestIds.length) return 0;
      const [guests, existing] = await Promise.all([
        tx
          .select({ id: schema.guests.id })
          .from(schema.guests)
          .where(and(eq(schema.guests.weddingId, weddingId), inArray(schema.guests.id, guestIds))),
        tx
          .select({ guestId: schema.messageDeliveries.guestId })
          .from(schema.messageDeliveries)
          .where(
            and(
              eq(schema.messageDeliveries.messageId, message.id),
              eq(schema.messageDeliveries.status, "sent"),
              isNotNull(schema.messageDeliveries.guestId),
            ),
          ),
      ]);
      const done = new Set(existing.map((e) => e.guestId));
      const rows = guests
        .filter((g) => !done.has(g.id))
        .map((g) => ({ id: newId(), weddingId, messageId: message.id, guestId: g.id, email: null, method, status: "sent" as const }));
      if (rows.length) {
        // Reached another way: an email still waiting to send for them shouldn't also go.
        await tx.delete(schema.messageDeliveries).where(
          and(
            eq(schema.messageDeliveries.messageId, message.id),
            eq(schema.messageDeliveries.status, "queued"),
            inArray(
              schema.messageDeliveries.guestId,
              rows.map((r) => r.guestId),
            ),
          ),
        );
        await tx.insert(schema.messageDeliveries).values(rows);
      }
      return rows.length;
    },
    { behavior: "immediate" },
  );
}

/** Undoes a mark the couple made (emails can't be unsent). */
export async function unmarkReached(weddingId: string, deliveryId: string): Promise<void> {
  const rows = await db
    .select({ id: schema.messageDeliveries.id, method: schema.messageDeliveries.method })
    .from(schema.messageDeliveries)
    .where(and(eq(schema.messageDeliveries.id, deliveryId), eq(schema.messageDeliveries.weddingId, weddingId)));
  if (!rows[0] || rows[0].method === "email") return;
  await db
    .delete(schema.messageDeliveries)
    .where(and(eq(schema.messageDeliveries.id, deliveryId), eq(schema.messageDeliveries.weddingId, weddingId)));
}
