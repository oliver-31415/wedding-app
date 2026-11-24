import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { emailEnabled, sendEmail, type SendResult } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { hashToken, newToken } from "@/lib/ids";

type Purpose = "verify_email" | "reset_password";
const TTL: Record<Purpose, number> = { verify_email: 3 * 86_400_000, reset_password: 60 * 60_000 };

/**
 * Accounts must confirm their email address — but only on servers that can
 * send email (SMTP set up), so nobody is locked out of a server without it.
 */
export const emailVerificationRequired = () => emailEnabled();

async function issueToken(userId: string, purpose: Purpose): Promise<string> {
  const token = newToken();
  // A new link replaces any older unused ones for the same purpose.
  await db
    .delete(schema.accountTokens)
    .where(and(eq(schema.accountTokens.userId, userId), eq(schema.accountTokens.purpose, purpose), isNull(schema.accountTokens.usedAt)));
  await db.insert(schema.accountTokens).values({
    id: hashToken(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + TTL[purpose]),
  });
  return token;
}

/** The account a still-valid link belongs to, without using it up. */
export async function peekToken(token: string | null | undefined, purpose: Purpose): Promise<string | null> {
  if (!token || !/^[A-Za-z0-9_-]{16,}$/.test(token)) return null;
  const [row] = await db
    .select({ userId: schema.accountTokens.userId })
    .from(schema.accountTokens)
    .where(
      and(
        eq(schema.accountTokens.id, hashToken(token)),
        eq(schema.accountTokens.purpose, purpose),
        isNull(schema.accountTokens.usedAt),
        gt(schema.accountTokens.expiresAt, new Date()),
      ),
    );
  return row?.userId ?? null;
}

/** Uses up a link; returns its account, or null if it's invalid, expired or already used. */
export async function consumeToken(token: string | null | undefined, purpose: Purpose): Promise<string | null> {
  if (!token || !/^[A-Za-z0-9_-]{16,}$/.test(token)) return null;
  const [row] = await db
    .update(schema.accountTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.accountTokens.id, hashToken(token)),
        eq(schema.accountTokens.purpose, purpose),
        isNull(schema.accountTokens.usedAt),
        gt(schema.accountTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.accountTokens.userId });
  return row?.userId ?? null;
}

export async function sendVerificationEmail(
  user: { id: string; name: string; email: string },
  nextPath: string | null = null,
): Promise<SendResult> {
  const token = await issueToken(user.id, "verify_email");
  const qs = new URLSearchParams({ token });
  if (nextPath) qs.set("next", nextPath);
  const rendered = renderEmail({
    heading: "Confirm your email",
    body: `Hi ${user.name.split(" ")[0]},\n\nPlease confirm this is your email address to finish setting up your account.\n\nThe link works for 3 days. If you didn't create an account, you can ignore this email.`,
    button: { label: "Confirm my email", url: `${appUrl()}/verify-email/confirm?${qs}` },
  });
  return sendEmail({ to: user.email, subject: "Confirm your email", ...rendered });
}

export async function sendPasswordResetEmail(user: { id: string; name: string; email: string }): Promise<SendResult> {
  const token = await issueToken(user.id, "reset_password");
  const rendered = renderEmail({
    heading: "Reset your password",
    body: `Hi ${user.name.split(" ")[0]},\n\nSomeone (hopefully you) asked to reset the password for your account. The link works once, for the next hour.\n\nIf it wasn't you, ignore this email — your password won't change.`,
    button: { label: "Choose a new password", url: `${appUrl()}/reset-password?token=${token}` },
  });
  return sendEmail({ to: user.email, subject: "Reset your password", ...rendered });
}
