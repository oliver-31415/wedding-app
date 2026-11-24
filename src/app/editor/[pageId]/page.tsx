import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VisualEditor } from "@/components/admin/editor/visual-editor";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { PAGE_TYPE_META, pageUrl } from "@/lib/pages";
import { getCoverPhoto, getGalleryPhotos, getItemPhotos, getPagePhoto } from "@/lib/photos";
import { pageTakesItemPhotos } from "@/lib/photos-shared";
import { toPublicWedding } from "@/lib/public-wedding";

export const metadata: Metadata = { title: "Edit website", robots: { index: false } };

/** Changes on every render, so the editor knows a save happened and refreshes its preview. */
const renderStamp = () => Date.now();

/**
 * The visual editor: the page as guests see it, where clicking a part opens
 * its editor beside it. Uses the same forms and actions as the Website pages.
 */
export default async function EditorPage({ params }: PageProps<"/editor/[pageId]">) {
  const { wedding, siteBase } = await requireHost();
  const { pageId } = await params;

  const pages = await db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, wedding.id))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));
  const page = pages.find((p) => p.id === pageId);
  if (!page) notFound();

  const [tags, items, coverPhoto, pagePhoto, itemPhotos, galleryPhotos] = await Promise.all([
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
    PAGE_TYPE_META[page.type].hasItems
      ? db
          .select({
            id: schema.pageItems.id,
            title: schema.pageItems.title,
            subtitle: schema.pageItems.subtitle,
            body: schema.pageItems.body,
            position: schema.pageItems.position,
          })
          .from(schema.pageItems)
          .where(and(eq(schema.pageItems.pageId, page.id), eq(schema.pageItems.weddingId, wedding.id)))
          .orderBy(asc(schema.pageItems.position), asc(schema.pageItems.createdAt))
      : [],
    getCoverPhoto(wedding.id),
    page.type !== "home" ? getPagePhoto(wedding.id, page.id) : null,
    pageTakesItemPhotos(page.type) ? getItemPhotos(wedding.id, page.id) : new Map(),
    page.type === "photos" ? getGalleryPhotos(wedding.id, page.id) : [],
  ]);

  return (
    <VisualEditor
      key={page.id}
      renderedAt={renderStamp()}
      wedding={toPublicWedding(wedding)}
      siteBase={siteBase}
      pages={pages.map((p) => ({ id: p.id, title: p.title, type: p.type, path: pageUrl(siteBase, p.slug) }))}
      page={{
        id: page.id,
        type: page.type,
        title: page.title,
        slug: page.slug,
        body: page.body,
        visibility: page.visibility,
        audience: page.audience,
      }}
      tags={tags}
      items={items}
      coverPhoto={coverPhoto}
      pagePhoto={pagePhoto}
      itemPhotos={Object.fromEntries(itemPhotos)}
      galleryPhotos={galleryPhotos}
    />
  );
}
