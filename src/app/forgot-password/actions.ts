"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { normalizeEmail } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { sendPasswordResetEmail } from "@/lib/account-emails";
import { emailEnabled } from "@/lib/email";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { extractClientIp, guestActionLimiter } from "@/lib/rsvp-guest/rate-limit";

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = text(formData, "email");
  if (!raw) return fail("Enter your email address.", { email: "Enter your email address." });
  if (!emailEnabled()) return fail("This server can't send email yet, so passwords can't be reset by email. Ask whoever runs it.");
  if (!guestActionLimiter.check(`reset:${extractClientIp(await headers())}`).allowed) {
    return fail("Too many requests — please wait a minute and try again.");
  }
  const email = normalizeEmail(raw);
  const [user] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, email));
  if (user) await sendPasswordResetEmail(user);
  // Same answer either way, so this can't be used to find out who has an account.
  return ok(`If ${email} has an account, we've emailed it a link to reset the password. It works for an hour.`);
}
