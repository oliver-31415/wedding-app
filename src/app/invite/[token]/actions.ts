"use server";

import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getCurrentUser, getHostContext } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { hashToken } from "@/lib/ids";

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  if (!user.emailVerified && emailEnabled()) redirect(`/verify-email?next=${encodeURIComponent(`/invite/${token}`)}`);

  const host = await getHostContext();
  if (host) redirect("/admin");

  const inviteId = hashToken(token);
  // Claim the invite and join in one locked step: deleting the row is what
  // makes it single-use, so a double-click or a shared link can't use it twice.
  const result = await db.transaction(
    async (tx): Promise<"joined" | "unavailable" | "wrong_email"> => {
      const [existing] = await tx
        .select({ weddingId: schema.weddingMembers.weddingId })
        .from(schema.weddingMembers)
        .where(eq(schema.weddingMembers.userId, user.id))
        .limit(1);
      if (existing) return "unavailable"; // one wedding per person; leave the invite for someone else
      const valid = and(eq(schema.cohostInvites.id, inviteId), gt(schema.cohostInvites.expiresAt, new Date()));
      const [pending] = await tx.select().from(schema.cohostInvites).where(valid);
      if (!pending) return "unavailable";
      // The invite was sent to one address; only that (confirmed) address can use it.
      if (pending.email.trim().toLowerCase() !== user.email.toLowerCase()) return "wrong_email";
      const [invite] = await tx.delete(schema.cohostInvites).where(valid).returning();
      if (!invite) return "unavailable";
      await tx.insert(schema.weddingMembers).values({ weddingId: invite.weddingId, userId: user.id, role: "cohost" });
      return "joined";
    },
    { behavior: "immediate" },
  );
  const joined = result === "joined";
  if (result === "wrong_email") redirect(`/invite/${encodeURIComponent(token)}?error=wrong_email`);

  if (!joined) redirect(`/invite/${encodeURIComponent(token)}`);
  redirect("/admin");
}
