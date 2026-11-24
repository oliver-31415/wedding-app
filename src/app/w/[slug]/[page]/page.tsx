import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NeedsGuestCard } from "@/components/site/needs-guest-card";
import {
  getViewerHouseholdGuests,
  getWeddingBySlug,
  getWeddingPages,
} from "@/components/site/site-data";
import { pageStyle } from "@/components/site/page-style";
import { SitePageView } from "@/components/site/site-page-view";
import { canViewPage, getViewer } from "@/lib/site-access";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page: pageSlug } = await params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) return {};
  const viewer = await getViewer(wedding);
  const [pages, householdGuests] = await Promise.all([
    getWeddingPages(wedding.id),
    getViewerHouseholdGuests(wedding.id, viewer.householdId),
  ]);
  const page = pages.find((p) => p.slug === pageSlug && p.slug !== "");
  // Only name the page in the tab title for people allowed to see it.
  if (!page || canViewPage(wedding, page, viewer, householdGuests) !== "ok") return {};
  return { title: page.title };
}

export default async function WeddingSubPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/[page]">) {
  const { slug, page: pageSlug } = await params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) notFound();

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) return null;

  const [pages, householdGuests] = await Promise.all([
    getWeddingPages(wedding.id),
    getViewerHouseholdGuests(wedding.id, viewer.householdId),
  ]);

  const page = pages.find((p) => p.slug === pageSlug && p.slug !== "");
  if (!page) notFound();

  const access = canViewPage(wedding, page, viewer, householdGuests);
  switch (access) {
    case "unpublished":
      return null;
    case "hidden":
    case "not_for_you":
      notFound();
    case "needs_password":
      redirect(
        `/w/${wedding.slug}/unlock?next=${encodeURIComponent(`/w/${wedding.slug}/${page.slug}`)}`,
      );
    case "needs_guest":
      return (
        <NeedsGuestCard weddingSlug={wedding.slug} nextPath={`/w/${wedding.slug}/${page.slug}`} />
      );
    case "ok":
      return (
        <SitePageView
          wedding={wedding}
          page={page}
          viewer={viewer}
          householdGuests={householdGuests}
          style={pageStyle(wedding, viewer, await searchParams)}
        />
      );
  }
}
