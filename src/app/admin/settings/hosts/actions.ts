"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cohostInviteExpiry } from "@/components/admin/settings/helpers";
import type { InviteCohostState } from "@/components/admin/settings/hosts-forms";
import { isValidEmail, normalizeEmail } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { text } from "@/lib/forms";
import { hashToken, newToken } from "@/lib/ids";

export async function inviteCohostAction(
  _prev: InviteCohostState,
  formData: FormData,
): Promise<InviteCohostState> {
  const { user, wedding, role } = await requireHost();
  if (role !== "owner") {
    return { ok: false, message: "Only the wedding owner can invite co-hosts." };
  }

  const rawEmail = text(formData, "email");
  if (!rawEmail) {
    return {
      ok: false,
      message: "Please fix the highlighted field.",
      errors: { email: "Enter an email address." },
    };
  }
  if (!isValidEmail(rawEmail)) {
    return {
      ok: false,
      message: "Please fix the highlighted field.",
      errors: { email: "Enter a valid email address." },
      submittedEmail: rawEmail,
    };
  }

  const email = normalizeEmail(rawEmail);

  const [existingMember] = await db
    .select({ userId: schema.weddingMembers.userId })
    .from(schema.weddingMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.weddingMembers.userId))
    .where(and(eq(schema.weddingMembers.weddingId, wedding.id), eq(schema.users.email, email)))
    .limit(1);

  if (existingMember) {
    return {
      ok: false,
      message: "Please fix the highlighted field.",
      errors: { email: "That person is already a host for this wedding." },
      submittedEmail: rawEmail,
    };
  }

  const token = newToken();
  const expiresAt = cohostInviteExpiry();

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.cohostInvites)
      .where(and(eq(schema.cohostInvites.weddingId, wedding.id), eq(schema.cohostInvites.email, email)));
    await tx.insert(schema.cohostInvites).values({
      id: hashToken(token),
      weddingId: wedding.id,
      email,
      expiresAt,
    });
  });

  const inviteUrl = `${appUrl()}/invite/${token}`;
  const coupleName = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const footer = wedding.date ? `${coupleName} · ${formatDateLong(wedding.date)}` : coupleName;

  const rendered = renderEmail({
    heading: coupleName,
    body: `${user.name} invited you to co-host ${coupleName}'s wedding.\n\nAs a co-host, you can edit the wedding website, manage the guest list and RSVPs, send messages and update the gift list.\n\nThis invitation link expires in 7 days.`,
    button: { label: "Accept invitation", url: inviteUrl },
    footer,
    accentColor: wedding.accentColor,
  });

  const emailResult = await sendEmail({
    to: email,
    subject: `You're invited to co-host ${coupleName}'s wedding`,
    html: rendered.html,
    text: rendered.text,
    weddingId: wedding.id,
  });

  revalidatePath("/admin/settings/hosts");

  return {
    ok: true,
    message: emailResult.ok
      ? `Invitation sent to ${email}.`
      : `Invite created for ${email}, though the email couldn't be delivered (${emailResult.error}). Copy the link below to share it directly.`,
    inviteUrl,
    invitedEmail: email,
  };
}

export async function removeCohostAction(formData: FormData): Promise<void> {
  const { wedding, role } = await requireHost();
  if (role !== "owner") return;

  const userId = text(formData, "userId");
  if (!userId) return;

  await db
    .delete(schema.weddingMembers)
    .where(
      and(
        eq(schema.weddingMembers.weddingId, wedding.id),
        eq(schema.weddingMembers.userId, userId),
        eq(schema.weddingMembers.role, "cohost"),
      ),
    );

  revalidatePath("/admin/settings/hosts");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const { wedding, role } = await requireHost();
  if (role !== "owner") return;

  const inviteId = text(formData, "inviteId");
  if (!inviteId) return;

  await db
    .delete(schema.cohostInvites)
    .where(and(eq(schema.cohostInvites.id, inviteId), eq(schema.cohostInvites.weddingId, wedding.id)));

  revalidatePath("/admin/settings/hosts");
}

export async function leaveWeddingAction(): Promise<void> {
  const { user, wedding, role } = await requireHost();
  if (role !== "cohost") return;

  await db
    .delete(schema.weddingMembers)
    .where(
      and(
        eq(schema.weddingMembers.weddingId, wedding.id),
        eq(schema.weddingMembers.userId, user.id),
        eq(schema.weddingMembers.role, "cohost"),
      ),
    );

  redirect("/onboarding");
}
