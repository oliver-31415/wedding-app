import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { sanitizeNextPath } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { consumeToken } from "@/lib/account-emails";

/** The link in the verification email. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
  const userId = await consumeToken(token, "verify_email");
  if (!userId) redirect(`/verify-email?error=expired${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
  // Signed in already → carry on; otherwise sign in, then continue.
  redirect(next ?? "/admin");
}
