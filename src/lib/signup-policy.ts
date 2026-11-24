import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/ids";
import { isSuperuser, superuserEmails } from "@/lib/superusers";

/**
 * Who may create an account.
 *  SIGNUP_MODE=open    anyone (the default in development)
 *  SIGNUP_MODE=invite  the default in production; allowed are:
 *    - emails in ALLOWED_SIGNUP_EMAILS (e.g. the couple on a single-wedding server),
 *    - super users (SUPERUSER_EMAILS — site admins on a multi-wedding server),
 *    - the very first account, but only when neither list is set,
 *    - someone with a valid sign-up invite link (/signup?invite=…, made on /site-admin),
 *    - someone following a co-host invite (/invite/…) to help run a wedding.
 */
export function signupMode(): "open" | "invite" {
  const mode = process.env.SIGNUP_MODE ?? (process.env.NODE_ENV === "production" ? "invite" : "open");
  return mode === "open" ? "open" : "invite";
}

export type SignupInvite = typeof schema.signupInvites.$inferSelect;

export async function findSignupInvite(token: string | null | undefined): Promise<SignupInvite | null> {
  if (!token || !/^[A-Za-z0-9_-]{16,}$/.test(token)) return null;
  const [invite] = await db
    .select()
    .from(schema.signupInvites)
    .where(
      and(
        eq(schema.signupInvites.id, hashToken(token)),
        isNull(schema.signupInvites.usedAt),
        gt(schema.signupInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite ?? null;
}

async function validCohostInvite(nextPath: string | null): Promise<boolean> {
  const token = /^\/invite\/([A-Za-z0-9_-]{16,})$/.exec(nextPath ?? "")?.[1];
  if (!token) return false;
  const [invite] = await db
    .select({ id: schema.cohostInvites.id })
    .from(schema.cohostInvites)
    .where(and(eq(schema.cohostInvites.id, hashToken(token)), gt(schema.cohostInvites.expiresAt, new Date())))
    .limit(1);
  return !!invite;
}

function allowedSignupEmails(): string[] {
  return (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when no email lists are configured, so the first visitor can claim the server. */
function firstComeFirstServed(): boolean {
  return allowedSignupEmails().length === 0 && superuserEmails().length === 0;
}

async function noAccountsYet(): Promise<boolean> {
  const [anyUser] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  return !anyUser;
}

/** Before we know the email (the sign-up page): does this visitor have a way in? */
export async function hasSignupAccess(args: { inviteToken: string | null; nextPath: string | null }): Promise<boolean> {
  if (signupMode() === "open") return true;
  if (firstComeFirstServed() && (await noAccountsYet())) return true;
  if (await findSignupInvite(args.inviteToken)) return true;
  return validCohostInvite(args.nextPath);
}

/** The final check when the form is submitted. Returns why not, or null if allowed. */
export async function signupRefusal(args: {
  email: string;
  inviteToken: string | null;
  nextPath: string | null;
}): Promise<string | null> {
  if (signupMode() === "open" || isSuperuser(args.email)) return null;
  if (allowedSignupEmails().includes(args.email.toLowerCase())) return null;
  if (firstComeFirstServed() && (await noAccountsYet())) return null;
  const invite = await findSignupInvite(args.inviteToken);
  if (invite) {
    if (invite.email && invite.email.toLowerCase() !== args.email.toLowerCase()) {
      return `This invite is for ${invite.email}. Sign up with that address, or ask for a new invite.`;
    }
    return null;
  }
  if (await validCohostInvite(args.nextPath)) return null;
  return "Sign-up is by invitation only. Ask a site admin or the couple for an invite link.";
}
