"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { type ActionState, fail, text } from "@/lib/forms";
import { safeNextPath } from "@/lib/pages";
import { revalidateWedding } from "@/lib/revalidate";
import { extractClientIp, guestActionLimiter } from "@/lib/rsvp-guest/rate-limit";
import { getViewer, unlockSite } from "@/lib/site-access";

export async function unlockSiteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = text(formData, "slug");
  if (!slug) return fail("Wedding not found.");

  const [wedding] = await db
    .select()
    .from(schema.weddings)
    .where(eq(schema.weddings.slug, slug))
    .limit(1);

  // Same answer whether the site is missing, unpublished or has no password,
  // so the form can't be used to probe which weddings exist.
  const notAvailable = fail("That password doesn’t match. Check your invitation and try again.", {
    password: "Incorrect password.",
  });
  if (!wedding || !wedding.sitePassword) return notAvailable;
  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) return notAvailable;

  const ip = extractClientIp(await headers());
  if (!guestActionLimiter.check(`unlock:${wedding.id}:${ip}`).allowed) {
    return fail("Too many attempts. Please wait a minute and try again.");
  }

  const attempt = text(formData, "password");
  if (!attempt) {
    return fail("Enter the site password.", { password: "Enter the site password." });
  }

  const ok = await unlockSite(wedding, attempt);
  revalidateWedding(wedding.slug);
  if (!ok) {
    return fail("That password doesn’t match. Check your invitation and try again.", {
      password: "Incorrect password.",
    });
  }

  const next = safeNextPath(text(formData, "next"), wedding.slug);
  redirect(next);
}
