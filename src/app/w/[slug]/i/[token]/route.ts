import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getWeddingBySlug } from "@/components/site/site-data";
import { db, schema } from "@/db";
import { pageUrl } from "@/lib/pages";
import { resolveSafeNext } from "@/lib/rsvp-guest/safe-next";
import { identifyHousehold } from "@/lib/site-access";
import { ROOT_SITE_SLUG, sitePath } from "@/lib/site-paths";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; token: string }> },
) {
  const { slug, token } = await context.params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) redirect(slug === ROOT_SITE_SLUG ? "/login" : `/w/${slug}/find`);
  const fallbackFind = sitePath(wedding.siteBase, "find");
  if (!token.trim()) redirect(fallbackFind);

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
  const fallback = pageUrl(wedding.siteBase, rsvpPage?.slug ?? "");
  const rawNext = request.nextUrl.searchParams.get("next");
  redirect(resolveSafeNext(wedding.siteBase, rawNext, fallback));
}
