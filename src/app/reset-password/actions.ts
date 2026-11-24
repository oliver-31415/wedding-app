"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { consumeToken } from "@/lib/account-emails";
import { endAllSessions, hashPassword, startSession } from "@/lib/auth";
import { fail, type ActionState } from "@/lib/forms";

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof password !== "string" || password.length < 10) {
    return fail("Please fix the highlighted field.", { password: "Use at least 10 characters." });
  }
  if (password !== confirm) return fail("Please fix the highlighted field.", { confirm: "The passwords don't match." });

  const userId = await consumeToken(typeof token === "string" ? token : null, "reset_password");
  if (!userId) return fail("This reset link has expired or was already used. Ask for a new one.");

  // Reaching this link proves they own the address, so it also confirms it.
  const [user] = await db.select({ verified: schema.users.emailVerifiedAt }).from(schema.users).where(eq(schema.users.id, userId));
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(password), emailVerifiedAt: user?.verified ?? new Date() })
    .where(eq(schema.users.id, userId));
  await endAllSessions(userId); // sign out every other device
  await startSession(userId);
  redirect("/admin");
}
