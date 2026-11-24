import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getViewerHouseholdGuests,
  getWeddingBySlug,
  getWeddingPages,
} from "@/components/site/site-data";
import { EditBridge } from "@/components/site/edit-bridge";
import { SiteShell, SiteShellView } from "@/components/site/site-shell";
import "@/components/site/site-styles.css";
import { formatDateLong } from "@/lib/dates";
import { pageUrl, selectNavPages } from "@/lib/pages";
import { getCoverPhoto, getPagePhoto } from "@/lib/photos";
import type { SitePhoto } from "@/lib/photos-shared";
import { canViewPage, getViewer } from "@/lib/site-access";
import { ROOT_SITE_SLUG } from "@/lib/site-paths";
import { resolveSiteStyle, splitHomeBody } from "@/lib/site-styles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const indexable = wedding.searchVisible && wedding.published;
  return {
    title: {
      default: couple,
      template: `%s · ${couple}`,
    },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function WeddingSiteLayout({
  children,
  params,
}: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) {
    // The domain root with no wedding there: the home page sends people to the app.
    if (slug === ROOT_SITE_SLUG) return children;
    notFound();
  }

  const viewer = await getViewer(wedding);

  const [pages, householdGuests] =
    !wedding.published && !viewer.isHost
      ? [[], []]
      : await Promise.all([
          getWeddingPages(wedding.id),
          getViewerHouseholdGuests(wedding.id, viewer.householdId),
        ]);

  const navPages = selectNavPages(pages, (p) =>
    canViewPage(wedding, p, viewer, householdGuests),
  );
  const navItems = navPages.map((p) => ({
    id: p.id,
    title: p.title,
    href: pageUrl(wedding.siteBase, p.slug),
    isHidden: viewer.isHost && p.visibility === "hidden",
  }));

  let coverPhoto: SitePhoto | null = null;
  let pagePhotos: Record<string, SitePhoto> | undefined;
  let homeGreeting: string | null = null;

  // Split renders the active page photo (or cover fallback) and Home greeting
  // in the shell. Load only for pages this viewer is allowed to see (and skip
  // completely when a guest views a non-Split site).
  if ((wedding.published || viewer.isHost) && (wedding.theme === "split" || viewer.isHost)) {
    const viewableNonHome = pages.filter(
      (p) => p.type !== "home" && canViewPage(wedding, p, viewer, householdGuests) === "ok",
    );
    const [cover, resolvedPagePhotos] = await Promise.all([
      getCoverPhoto(wedding.id),
      Promise.all(
        viewableNonHome.map(async (p) => [
          pageUrl(wedding.siteBase, p.slug),
          await getPagePhoto(wedding.id, p.id),
        ] as const),
      ),
    ]);
    coverPhoto = cover;
    const map: Record<string, SitePhoto> = {};
    for (const [href, photo] of resolvedPagePhotos) {
      if (photo) map[href] = photo;
    }
    pagePhotos = map;

    const homePage = pages.find((p) => p.type === "home");
    if (homePage && canViewPage(wedding, homePage, viewer, householdGuests) === "ok") {
      homeGreeting = splitHomeBody(homePage.body).lead;
    }
  }

  const subtitle = [
    wedding.date ? formatDateLong(wedding.date) : null,
    wedding.locationName,
  ]
    .filter(Boolean)
    .join(" · ");

  const defaultResolved = resolveSiteStyle({
    savedTheme: wedding.theme,
    savedAccent: wedding.accentColor,
    isHost: false,
  });

  // Only non-secret display fields cross the server → client boundary.
  const shellProps = {
    siteBase: wedding.siteBase,
    partnerOne: wedding.partnerOne,
    partnerTwo: wedding.partnerTwo,
    subtitle,
    published: wedding.published,
    isHost: viewer.isHost,
    navItems,
    coverPhoto,
    pagePhotos,
    homeGreeting,
  };

  if (!viewer.isHost) {
    return (
      <SiteShellView {...shellProps} resolved={defaultResolved} previewQuery="">
        {children}
      </SiteShellView>
    );
  }

  return (
    <Suspense
      fallback={
        <SiteShellView {...shellProps} resolved={defaultResolved} previewQuery="">
          {children}
        </SiteShellView>
      }
    >
      <SiteShell
        {...shellProps}
        savedTheme={wedding.theme}
        savedAccent={wedding.accentColor}
      >
        {children}
      </SiteShell>
      {/* Hosts only: lets the visual editor (/editor/…) click parts of this page. */}
      <EditBridge />
    </Suspense>
  );
}
