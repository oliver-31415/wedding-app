import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { emailEnabled } from "@/lib/email";
import { hashToken, newToken } from "@/lib/ids";
import { siteBaseOf } from "@/lib/site-root";

const SESSION_COOKIE = "wa_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Call from a Server Action after verifying credentials. */
export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = { id: string; email: string; name: string; emailVerified: boolean };

/** The signed-in host, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      emailVerifiedAt: schema.users.emailVerifiedAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, emailVerified: !!row.emailVerifiedAt };
});

/**
 * Signed in, and — on servers that send email — with a confirmed address.
 * Use for anything account-level that isn't inside a wedding (onboarding,
 * accepting invites, site admin). requireHost() includes this.
 */
export async function requireVerifiedUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerified && emailEnabled()) redirect("/verify-email");
  return user;
}

/** Signs the account out everywhere (after a password reset). */
export async function endAllSessions(userId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export type Wedding = typeof schema.weddings.$inferSelect;
export type HostContext = {
  user: CurrentUser;
  wedding: Wedding;
  role: "owner" | "cohost";
  /** Where the guest site lives: "" at the root, else /w/{slug} (src/lib/site-paths.ts). */
  siteBase: string;
};

/** The signed-in host's wedding, or null if they haven't created one yet. */
export const getHostContext = cache(async (): Promise<HostContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const [row] = await db
    .select({ wedding: schema.weddings, role: schema.weddingMembers.role })
    .from(schema.weddingMembers)
    .innerJoin(schema.weddings, eq(schema.weddings.id, schema.weddingMembers.weddingId))
    .where(eq(schema.weddingMembers.userId, user.id))
    .limit(1);
  return row ? { user, wedding: row.wedding, role: row.role, siteBase: await siteBaseOf(row.wedding) } : null;
});

/**
 * Every admin page and admin Server Action starts with this. Scope every
 * query by the returned `wedding.id` — never by an id from the request alone.
 */
export async function requireHost(): Promise<HostContext> {
  await requireVerifiedUser();
  const ctx = await getHostContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export async function requireOwner(): Promise<HostContext> {
  const ctx = await requireHost();
  if (ctx.role !== "owner") redirect("/admin");
  return ctx;
}
