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
import { getCurrentUser } from "@/lib/auth";
import { canViewPage, getViewer } from "@/lib/site-access";
import { ROOT_SITE_SLUG, sitePath } from "@/lib/site-paths";

export default async function WeddingHomePage({
  params,
  searchParams,
}: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) {
    // The domain root on a server with no wedding there yet: the app itself.
    if (slug === ROOT_SITE_SLUG) redirect((await getCurrentUser()) ? "/admin" : "/login");
    notFound();
  }

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
      redirect(pageUrl(wedding.siteBase, landing.slug));
    case "unlock":
      redirect(`${sitePath(wedding.siteBase, "unlock")}?next=${encodeURIComponent(sitePath(wedding.siteBase))}`);
    case "needs_guest":
      return (
        <NeedsGuestCard siteBase={wedding.siteBase} nextPath={sitePath(wedding.siteBase)} />
      );
    case "empty":
      return null;
  }
}
