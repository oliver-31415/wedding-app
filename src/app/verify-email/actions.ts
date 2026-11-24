"use server";

import { headers } from "next/headers";
import { sendVerificationEmail } from "@/lib/account-emails";
import { getCurrentUser } from "@/lib/auth";
import { fail, ok, type ActionState } from "@/lib/forms";
import { extractClientIp, guestActionLimiter } from "@/lib/rsvp-guest/rate-limit";

export async function resendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.");
  if (user.emailVerified) return ok("Your email is already confirmed.");
  if (!guestActionLimiter.check(`verify:${user.id}:${extractClientIp(await headers())}`).allowed) {
    return fail("You've asked for a few emails already — please wait a minute.");
  }
  const next = formData.get("next");
  const sent = await sendVerificationEmail(user, typeof next === "string" && next.startsWith("/") ? next : null);
  return sent.ok ? ok(`Sent — check ${user.email} (and your spam folder).`) : fail(`We couldn't send the email: ${sent.error}`);
}
