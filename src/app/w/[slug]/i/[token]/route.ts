import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { resolveSafeNext } from "@/lib/rsvp-guest/safe-next";
import { identifyHousehold } from "@/lib/site-access";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await context.params;
  const fallbackFind = `/w/${slug}/find`;

  const [wedding] = await db
    .select({ id: schema.weddings.id, slug: schema.weddings.slug })
    .from(schema.weddings)
    .where(eq(schema.weddings.slug, slug));

  if (!wedding || !token.trim()) {
    redirect(fallbackFind);
  }

  const [household] = await db
    .select({ id: schema.households.id })
    .from(schema.households)
    .where(
      and(
        eq(schema.households.weddingId, wedding.id),
        eq(schema.households.inviteToken, token),
      ),
    );

  if (!household) {
    redirect(fallbackFind);
  }

  // Signing the guest in even before the site is published is deliberate:
  // they still see nothing until it is, and links sent early keep working.
  await identifyHousehold(wedding.id, household.id);
  const [rsvpPage] = await db
    .select({ slug: schema.pages.slug })
    .from(schema.pages)
    .where(and(eq(schema.pages.weddingId, wedding.id), eq(schema.pages.type, "rsvp")))
    .limit(1);
  const fallback = rsvpPage ? `/w/${wedding.slug}/${rsvpPage.slug}` : `/w/${wedding.slug}`;
  const rawNext = request.nextUrl.searchParams.get("next");
  redirect(resolveSafeNext(wedding.slug, rawNext, fallback));
}
