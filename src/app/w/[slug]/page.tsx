import { notFound, redirect } from "next/navigation";
import { NeedsGuestCard } from "@/components/site/needs-guest-card";
import {
  getViewerHouseholdGuests,
  getWeddingBySlug,
  getWeddingPages,
} from "@/components/site/site-data";
import { pageStyle } from "@/components/site/page-style";
import { SitePageView } from "@/components/site/site-page-view";
import { pageUrl, resolveHomeLanding } from "@/lib/pages";
import { canViewPage, getViewer } from "@/lib/site-access";

export default async function WeddingHomePage({
  params,
  searchParams,
}: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) notFound();

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) return null;

  const [pages, householdGuests] = await Promise.all([
    getWeddingPages(wedding.id),
    getViewerHouseholdGuests(wedding.id, viewer.householdId),
  ]);

  const landing = resolveHomeLanding(pages, (p) =>
    canViewPage(wedding, p, viewer, householdGuests),
  );

  switch (landing.kind) {
    case "render":
      return (
        <SitePageView
          wedding={wedding}
          page={landing.page}
          viewer={viewer}
          householdGuests={householdGuests}
          style={pageStyle(wedding, viewer, await searchParams)}
        />
      );
    case "redirect":
      redirect(pageUrl(wedding.slug, landing.slug));
    case "unlock":
      redirect(`/w/${wedding.slug}/unlock?next=${encodeURIComponent(`/w/${wedding.slug}`)}`);
    case "needs_guest":
      return (
        <NeedsGuestCard weddingSlug={wedding.slug} nextPath={`/w/${wedding.slug}`} />
      );
    case "empty":
      return null;
  }
}
