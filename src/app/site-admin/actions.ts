"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireVerifiedUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { hashToken, newToken } from "@/lib/ids";
import { isSuperuser } from "@/lib/superusers";

const INVITE_DAYS = 14;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function requireSuperuser() {
  const user = await requireVerifiedUser();
  if (!isSuperuser(user.email)) redirect("/admin");
  return user;
}

export type InviteState = (ActionState & { link?: string }) | null;

export async function createSignupInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireSuperuser();
  const email = text(formData, "email")?.toLowerCase() ?? null;
  const note = text(formData, "note");
  if (email && !EMAIL_RE.test(email)) return fail("Please fix the highlighted field.", { email: "Enter a valid email address." });
  if (note && note.length > 200) return fail("Please fix the highlighted field.", { note: "Keep the note under 200 characters." });

  const token = newToken();
  await db.insert(schema.signupInvites).values({
    id: hashToken(token),
    email,
    note,
    createdBy: user.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });
  const link = `${appUrl()}/signup?invite=${token}`;

  let message = `Invite created. It works once and expires in ${INVITE_DAYS} days — copy the link below; it won't be shown again.`;
  if (email) {
    const rendered = renderEmail({
      heading: "You're invited",
      body: `Hi,\n\n${user.name} has invited you to create an account on our wedding website.\n\nThe link works once and expires in ${INVITE_DAYS} days.`,
      button: { label: "Create your account", url: link },
    });
    const sent = await sendEmail({ to: email, subject: `${user.name} invited you to join`, ...rendered });
    message = sent.ok ? `Invite emailed to ${email}. You can also copy the link below.` : `${message} (Email couldn't be sent: ${sent.error})`;
  }
  revalidatePath("/site-admin");
  return { ...ok(message), link };
}

export async function revokeSignupInviteAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.signupInvites).where(and(eq(schema.signupInvites.id, id), isNull(schema.signupInvites.usedAt)));
  revalidatePath("/site-admin");
}
