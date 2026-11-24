"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { normalizeEmail, sanitizeNextPath } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { startSession, verifyPassword } from "@/lib/auth";
import { fail, text, type ActionState } from "@/lib/forms";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rawEmail = text(formData, "email");
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const nextPath = sanitizeNextPath(text(formData, "next"));

  const errors: Record<string, string> = {};
  if (!rawEmail) errors.email = "Enter your email address.";
  if (!password) errors.password = "Enter your password.";
  if (Object.keys(errors).length > 0) {
    return fail("Please enter your email and password.", errors);
  }

  const email = normalizeEmail(rawEmail!);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) return fail("Email or password is incorrect.");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail("Email or password is incorrect.");

  await startSession(user.id);
  redirect(nextPath ?? "/admin");
}
