"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { normalizeEmail, sanitizeNextPath, validateSignupInput } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { hashPassword, startSession } from "@/lib/auth";
import { fail, text, type ActionState } from "@/lib/forms";
import { emailVerificationRequired, sendVerificationEmail } from "@/lib/account-emails";
import { newId } from "@/lib/ids";
import { findSignupInvite, signupRefusal } from "@/lib/signup-policy";
import { isSuperuser } from "@/lib/superusers";

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "name");
  const rawEmail = text(formData, "email");
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" && rawPassword.length > 0 ? rawPassword : null;
  const nextPath = sanitizeNextPath(text(formData, "next"));

  const inviteToken = text(formData, "invite");

  const errors = validateSignupInput({ name, email: rawEmail, password });
  if (Object.keys(errors).length > 0) {
    return fail("Please fix the highlighted fields.", errors);
  }

  const email = normalizeEmail(rawEmail!);
  const refusal = await signupRefusal({ email, inviteToken, nextPath });
  if (refusal) return fail(refusal);
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) {
    return fail("Please fix the highlighted fields.", {
      email: "An account with this email already exists.",
    });
  }

  const userId = newId();
  const passwordHash = await hashPassword(password!);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({ id: userId, name: name!, email, passwordHash });
      // Use up the sign-up invite in the same step, so one link makes one account.
      const invite = await findSignupInvite(inviteToken);
      if (invite && !isSuperuser(email)) {
        const used = await tx
          .update(schema.signupInvites)
          .set({ usedAt: new Date(), usedBy: userId })
          .where(and(eq(schema.signupInvites.id, invite.id), isNull(schema.signupInvites.usedAt)))
          .returning({ id: schema.signupInvites.id });
        if (used.length === 0) throw new Error("INVITE_USED");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_USED") {
      return fail("That invite link has just been used. Ask for a new one.");
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("unique")) {
      return fail("Please fix the highlighted fields.", {
        email: "An account with this email already exists.",
      });
    }
    throw err;
  }

  await startSession(userId);
  if (emailVerificationRequired()) {
    await sendVerificationEmail({ id: userId, name: name!, email }, nextPath ?? "/onboarding");
    redirect(`/verify-email${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  }
  redirect(nextPath ?? "/onboarding");
}
