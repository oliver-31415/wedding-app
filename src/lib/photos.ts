import "server-only";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { PageType, PhotoKind } from "@/db/schema";
import { newId } from "@/lib/ids";
import {
  DEFAULT_FOCUS,
  isFocus,
  itemPhotoCap,
  MAX_ALT,
  MAX_CAPTION,
  PHOTO_CAPS,
  pageTakesItemPhotos,
  type SitePhoto,
} from "@/lib/photos-shared";
import { deleteUpload, saveUploadedImage } from "@/lib/uploads";

/**
 * Every photo write goes through here, so caps are checked in one place and
 * a file on disk is always deleted with its row. Scope everything by weddingId.
 */

type Row = typeof schema.photos.$inferSelect;
export type PhotoResult = { ok: true; photo: Row } | { ok: false; error: string };

const toSitePhoto = (p: Row): SitePhoto => ({
  id: p.id,
  url: p.url,
  width: p.width,
  height: p.height,
  alt: p.alt,
  caption: p.caption,
  focus: p.focus,
});

const clean = (v: string | null | undefined, max: number) => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

// ---------------------------------------------------------------- reading

export async function getCoverPhoto(weddingId: string): Promise<SitePhoto | null> {
  const [row] = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "cover")))
    .limit(1);
  return row ? toSitePhoto(row) : null;
}

/** A Photos page's gallery, in order. */
export async function getGalleryPhotos(weddingId: string, pageId: string): Promise<SitePhoto[]> {
  const rows = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.photos.pageId, pageId), eq(schema.photos.kind, "gallery")))
    .orderBy(asc(schema.photos.position), asc(schema.photos.createdAt));
  return rows.map(toSitePhoto);
}

/** Photos of a story / party page's items, keyed by page item id. */
export async function getItemPhotos(weddingId: string, pageId: string): Promise<Map<string, SitePhoto>> {
  const rows = await db
    .select({ photo: schema.photos })
    .from(schema.photos)
    .innerJoin(schema.pageItems, eq(schema.pageItems.id, schema.photos.pageItemId))
    .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.pageItems.pageId, pageId)));
  return new Map(rows.map(({ photo }) => [photo.pageItemId!, toSitePhoto(photo)]));
}

/** How many photos deleting each page would remove (the Home page includes the cover). */
export async function photoCountsByPage(weddingId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      kind: schema.photos.kind,
      galleryPage: schema.photos.pageId,
      itemPage: schema.pageItems.pageId,
    })
    .from(schema.photos)
    .leftJoin(schema.pageItems, eq(schema.pageItems.id, schema.photos.pageItemId))
    .where(eq(schema.photos.weddingId, weddingId));
  const [home] = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(and(eq(schema.pages.weddingId, weddingId), eq(schema.pages.type, "home")));
  const counts = new Map<string, number>();
  for (const r of rows) {
    const pageId = r.kind === "cover" ? home?.id : (r.galleryPage ?? r.itemPage);
    if (pageId) counts.set(pageId, (counts.get(pageId) ?? 0) + 1);
  }
  return counts;
}

/** The sentence a delete confirmation adds when photos go too. */
export const photosGoToo = (n: number) => (n ? ` Its ${n === 1 ? "photo" : `${n} photos`} will be deleted too.` : "");

// ---------------------------------------------------------------- writing

/** Runs the database write for a just-stored file; if it throws, the file goes too. */
async function keepFileOnlyIfSaved<T>(url: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (e) {
    await deleteUpload(url);
    throw e;
  }
}

type Details = { alt?: string | null; caption?: string | null; focus?: string | null };

function detailValues(kind: PhotoKind, d: Details, fallbackFocus: string) {
  return {
    alt: clean(d.alt, MAX_ALT),
    // Captions are for the Photos page only.
    caption: kind === "gallery" ? clean(d.caption, MAX_CAPTION) : null,
    focus: isFocus(d.focus) ? d.focus : fallbackFocus,
  };
}

/** Sets (or replaces) the wedding's cover photo. */
export async function setCoverPhoto(weddingId: string, file: File, details: Details): Promise<PhotoResult> {
  const saved = await saveUploadedImage(file, { photo: true });
  if (!saved.ok) return saved;
  const { photo, oldUrl } = await keepFileOnlyIfSaved(saved.url, () => db.transaction(
    async (tx) => {
      const [old] = await tx
        .select({ id: schema.photos.id, url: schema.photos.url })
        .from(schema.photos)
        .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "cover")));
      if (old) await tx.delete(schema.photos).where(and(eq(schema.photos.id, old.id), eq(schema.photos.weddingId, weddingId)));
      const [photo] = await tx
        .insert(schema.photos)
        .values({
          id: newId(),
          weddingId,
          kind: "cover",
          url: saved.url,
          width: saved.width,
          height: saved.height,
          ...detailValues("cover", details, DEFAULT_FOCUS.cover),
        })
        .returning();
      return { photo, oldUrl: old?.url };
    },
    { behavior: "immediate" },
  ));
  await deleteUpload(oldUrl);
  return { ok: true, photo };
}

/** Sets (or replaces) the photo of a story milestone or wedding-party member. */
export async function setItemPhoto(weddingId: string, pageItemId: string, file: File, details: Details): Promise<PhotoResult> {
  const [item] = await db
    .select({ id: schema.pageItems.id, pageId: schema.pageItems.pageId, pageType: schema.pages.type })
    .from(schema.pageItems)
    .innerJoin(schema.pages, eq(schema.pages.id, schema.pageItems.pageId))
    .where(and(eq(schema.pageItems.id, pageItemId), eq(schema.pageItems.weddingId, weddingId)));
  if (!item || !pageTakesItemPhotos(item.pageType)) return { ok: false, error: "This item can't have a photo." };
  const cap = itemPhotoCap(item.pageType);

  const saved = await saveUploadedImage(file, { photo: true });
  if (!saved.ok) return saved;
  const result = await keepFileOnlyIfSaved(saved.url, () => db.transaction(
    async (tx): Promise<{ photo: Row; oldUrl?: string } | { error: string }> => {
      const [old] = await tx
        .select({ id: schema.photos.id, url: schema.photos.url })
        .from(schema.photos)
        .where(and(eq(schema.photos.pageItemId, item.id), eq(schema.photos.weddingId, weddingId)));
      if (!old) {
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)` })
          .from(schema.photos)
          .innerJoin(schema.pageItems, eq(schema.pageItems.id, schema.photos.pageItemId))
          .where(and(eq(schema.pageItems.pageId, item.pageId), eq(schema.photos.weddingId, weddingId)));
        if (n >= cap) {
          return { error: `This page already has ${cap} photos, the most it can have. Remove one first.` };
        }
      } else {
        await tx.delete(schema.photos).where(and(eq(schema.photos.id, old.id), eq(schema.photos.weddingId, weddingId)));
      }
      const [photo] = await tx
        .insert(schema.photos)
        .values({
          id: newId(),
          weddingId,
          kind: "item",
          pageItemId: item.id,
          url: saved.url,
          width: saved.width,
          height: saved.height,
          ...detailValues("item", details, item.pageType === "party" ? DEFAULT_FOCUS.portrait : DEFAULT_FOCUS.item),
        })
        .returning();
      return { photo, oldUrl: old?.url };
    },
    { behavior: "immediate" },
  ));
  if ("error" in result) {
    await deleteUpload(saved.url);
    return { ok: false, error: result.error };
  }
  await deleteUpload(result.oldUrl);
  return { ok: true, photo: result.photo };
}

/** Adds a photo to the end of a Photos page. */
export async function addGalleryPhoto(weddingId: string, pageId: string, file: File, details: Details): Promise<PhotoResult> {
  const [page] = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(and(eq(schema.pages.id, pageId), eq(schema.pages.weddingId, weddingId), eq(schema.pages.type, "photos")));
  if (!page) return { ok: false, error: "That page doesn't exist." };

  const saved = await saveUploadedImage(file, { photo: true });
  if (!saved.ok) return saved;
  const result = await keepFileOnlyIfSaved(saved.url, () => db.transaction(
    async (tx): Promise<{ photo: Row } | { error: string }> => {
      const [{ n, last }] = await tx
        .select({ n: sql<number>`count(*)`, last: sql<number | null>`max(${schema.photos.position})` })
        .from(schema.photos)
        .where(and(eq(schema.photos.pageId, page.id), eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "gallery")));
      if (n >= PHOTO_CAPS.gallery) {
        return { error: `The Photos page holds up to ${PHOTO_CAPS.gallery} photos. Remove one to add another.` };
      }
      const [photo] = await tx
        .insert(schema.photos)
        .values({
          id: newId(),
          weddingId,
          kind: "gallery",
          pageId: page.id,
          url: saved.url,
          width: saved.width,
          height: saved.height,
          position: (last ?? -1) + 1,
          ...detailValues("gallery", details, DEFAULT_FOCUS.gallery),
        })
        .returning();
      return { photo };
    },
    { behavior: "immediate" },
  ));
  if ("error" in result) {
    await deleteUpload(saved.url);
    return { ok: false, error: result.error };
  }
  return { ok: true, photo: result.photo };
}

/** Changes a photo's description, caption or crop (the file stays). */
export async function updatePhotoDetails(weddingId: string, photoId: string, details: Details): Promise<boolean> {
  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.id, photoId), eq(schema.photos.weddingId, weddingId)));
  if (!photo) return false;
  await db
    .update(schema.photos)
    .set(detailValues(photo.kind, details, photo.focus))
    .where(and(eq(schema.photos.id, photo.id), eq(schema.photos.weddingId, weddingId)));
  return true;
}

export async function deletePhoto(weddingId: string, photoId: string): Promise<void> {
  const [gone] = await db
    .delete(schema.photos)
    .where(and(eq(schema.photos.id, photoId), eq(schema.photos.weddingId, weddingId)))
    .returning({ url: schema.photos.url });
  await deleteUpload(gone?.url);
}

/** Moves a gallery photo one place up or down. */
export async function moveGalleryPhoto(weddingId: string, photoId: string, direction: "up" | "down"): Promise<void> {
  await db.transaction(
    async (tx) => {
      const [photo] = await tx
        .select({ pageId: schema.photos.pageId })
        .from(schema.photos)
        .where(and(eq(schema.photos.id, photoId), eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "gallery")));
      if (!photo?.pageId) return;
      const ids = (
        await tx
          .select({ id: schema.photos.id })
          .from(schema.photos)
          .where(and(eq(schema.photos.pageId, photo.pageId), eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "gallery")))
          .orderBy(asc(schema.photos.position), asc(schema.photos.createdAt))
      ).map((r) => r.id);
      const i = ids.indexOf(photoId);
      const j = direction === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (const [position, id] of ids.entries()) {
        await tx
          .update(schema.photos)
          .set({ position })
          .where(and(eq(schema.photos.id, id), eq(schema.photos.weddingId, weddingId)));
      }
    },
    { behavior: "immediate" },
  );
}

// ---------------------------------------------------------------- cleanup

type Reader = Pick<typeof db, "select">;

/**
 * Photo files that go when a page (its gallery and its items' photos; the
 * Home page takes the cover photo with it) or some page items are deleted.
 * Call inside the deleting transaction, delete the rows, then pass the result
 * to `deletePhotoFiles` once it has committed.
 */
export async function photoFilesFor(
  reader: Reader,
  weddingId: string,
  target: { pageId: string; pageType: PageType } | { pageItemIds: string[] },
): Promise<string[]> {
  if ("pageId" in target) {
    const [gallery, items, cover] = await Promise.all([
      reader
        .select({ url: schema.photos.url })
        .from(schema.photos)
        .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.photos.pageId, target.pageId))),
      reader
        .select({ url: schema.photos.url })
        .from(schema.photos)
        .innerJoin(schema.pageItems, eq(schema.pageItems.id, schema.photos.pageItemId))
        .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.pageItems.pageId, target.pageId))),
      target.pageType === "home"
        ? reader
            .select({ url: schema.photos.url })
            .from(schema.photos)
            .where(and(eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "cover")))
        : [],
    ]);
    return [...gallery, ...items, ...cover].map((r) => r.url);
  }
  if (!target.pageItemIds.length) return [];
  const rows = await reader
    .select({ url: schema.photos.url })
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.weddingId, weddingId),
        isNotNull(schema.photos.pageItemId),
        inArray(schema.photos.pageItemId, target.pageItemIds),
      ),
    );
  return rows.map((r) => r.url);
}

/** The cover photo has no page row to cascade from: delete it with the Home page. */
export async function deleteCoverRow(tx: Pick<typeof db, "delete">, weddingId: string): Promise<void> {
  await tx.delete(schema.photos).where(and(eq(schema.photos.weddingId, weddingId), eq(schema.photos.kind, "cover")));
}

export async function deletePhotoFiles(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => deleteUpload(u)));
}
