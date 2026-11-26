"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { bool, text } from "@/lib/forms";
import { revalidateWedding } from "@/lib/revalidate";
import { guestName } from "@/lib/rsvp/model";
import { sitePath } from "@/lib/site-paths";

export type NameCheckResult = null | {
  ok: boolean;
  message: string;
  /** Their personal invite link, when the email couldn't be sent. */
  link?: string;
};

/** Accept (this request is that guest) or dismiss ("Not on our list"). */
export async function resolveNameCheckAction(_prev: NameCheckResult, formData: FormData): Promise<NameCheckResult> {
  const { wedding, siteBase } = await requireHost();
  const id = text(formData, "id");
  const intent = text(formData, "intent");
  if (!id) return { ok: false, message: "That request is gone. Refresh the page." };

  const [request] = await db
    .select()
    .from(schema.nameRequests)
    .where(and(eq(schema.nameRequests.id, id), eq(schema.nameRequests.weddingId, wedding.id)));
  if (!request || request.status !== "pending") {
    return { ok: false, message: "That request was already dealt with." };
  }
  const typed = `${request.firstName} ${request.lastName}`;

  if (intent === "dismiss") {
    await db
      .update(schema.nameRequests)
      .set({ status: "dismissed", resolvedAt: new Date() })
      .where(and(eq(schema.nameRequests.id, id), eq(schema.nameRequests.weddingId, wedding.id), eq(schema.nameRequests.status, "pending")));
    revalidateWedding();
    return { ok: true, message: `Dismissed ${typed}. They weren't emailed.` };
  }

  const guestId = text(formData, "guestId");
  if (!guestId) return { ok: false, message: `Choose who ${typed} is.` };
  const [found] = await db
    .select({ guest: schema.guests, inviteToken: schema.households.inviteToken })
    .from(schema.guests)
    .innerJoin(schema.households, eq(schema.households.id, schema.guests.householdId))
    .where(
      and(
        eq(schema.guests.id, guestId),
        eq(schema.guests.weddingId, wedding.id),
        eq(schema.households.weddingId, wedding.id),
      ),
    );
  if (!found) return { ok: false, message: "That guest isn't on your list any more. Refresh the page." };
  const { guest, inviteToken } = found;

  const updated = await db
    .update(schema.nameRequests)
    .set({ status: "accepted", guestId: guest.id, resolvedAt: new Date() })
    .where(and(eq(schema.nameRequests.id, id), eq(schema.nameRequests.weddingId, wedding.id), eq(schema.nameRequests.status, "pending")))
    .returning({ id: schema.nameRequests.id });
  if (updated.length === 0) return { ok: false, message: "That request was already dealt with." };

  const savedEmail = bool(formData, "saveEmail") && guest.email?.toLowerCase() !== request.email;
  if (savedEmail) {
    await db
      .update(schema.guests)
      .set({ email: request.email })
      .where(and(eq(schema.guests.id, guest.id), eq(schema.guests.weddingId, wedding.id)));
  }
  revalidateWedding();

  const link = `${appUrl()}${sitePath(siteBase, `i/${inviteToken}`)}`;
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const { html, text: plain } = renderEmail({
    heading: couple,
    body: `Hi ${guest.firstName},\n\nThanks for letting us know you couldn't find your invitation. We've found you, so here's your personal link to see the details and RSVP.\n\nThe link is just for you and your household, so please don't share it.`,
    button: { label: "See your invitation", url: link },
    footer: wedding.date ? `${couple} · ${formatDateLong(wedding.date)}` : couple,
    accentColor: wedding.accentColor,
  });
  let error: string | null = null;
  try {
    const sent = await sendEmail({ to: request.email, subject: `Your invitation from ${couple}`, html, text: plain, weddingId: wedding.id });
    if (!sent.ok) error = sent.error;
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const name = guestName(guest);
  if (error) {
    return {
      ok: false,
      message: `Saved: ${typed} is ${name}${savedEmail ? `, and ${request.email} is now their email` : ""}. But the email couldn't be sent: ${error}. Copy their link instead.`,
      link,
    };
  }
  return {
    ok: true,
    message: `Saved: ${typed} is ${name}. We've emailed their invitation link to ${request.email}${savedEmail ? " and saved it as their email" : ""}.`,
  };
}

/** Stop recognising an accepted name. Their personal link still works. */
export async function forgetNameAliasAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db
    .delete(schema.nameRequests)
    .where(and(eq(schema.nameRequests.id, id), eq(schema.nameRequests.weddingId, wedding.id), eq(schema.nameRequests.status, "accepted")));
  revalidateWedding();
}
