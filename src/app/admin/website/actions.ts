"use server";

import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { PAGE_VISIBILITY, type PageType, type PageVisibility } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { type ActionState, fail, moveId, ok, readAudience, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { deleteCoverRow, deletePhotoFiles, photoFilesFor } from "@/lib/photos";
import { revalidateWedding } from "@/lib/revalidate";
import {
  canAddPageType,
  isPageType,
  PAGE_TYPE_META,
  uniqueCustomSlug,
  validateCustomSlug,
} from "@/lib/pages";

export async function addBuiltInPageAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const rawType = text(formData, "type") ?? "";
  if (!isPageType(rawType) || rawType === "custom") return;

  const existing = await db
    .select({ id: schema.pages.id, type: schema.pages.type, position: schema.pages.position })
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, wedding.id))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));

  if (!canAddPageType(rawType, existing)) {
    const match = existing.find((p) => p.type === rawType);
    if (match) redirect(`/admin/website/${match.id}`);
    return;
  }

  const meta = PAGE_TYPE_META[rawType];
  const id = newId();
  await db.insert(schema.pages).values({
    id,
    weddingId: wedding.id,
    type: rawType,
    title: meta.defaultTitle,
    slug: meta.fixedSlug ?? "",
    body: null,
    visibility: "public",
    position: existing.length,
  });

  revalidateWedding();
  redirect(`/admin/website/${id}`);
}

export async function addCustomPageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const title = text(formData, "title");
  if (!title) {
    return fail("Enter a title for your custom page.", { title: "Enter a page title." });
  }

  const existing = await db
    .select({ slug: schema.pages.slug, position: schema.pages.position })
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, wedding.id))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));

  const slug = uniqueCustomSlug(title, existing.map((p) => p.slug));
  const id = newId();
  await db.insert(schema.pages).values({
    id,
    weddingId: wedding.id,
    type: "custom",
    title,
    slug,
    body: null,
    visibility: "public",
    position: existing.length,
  });

  revalidateWedding();
  redirect(`/admin/website/${id}`);
}

export async function reorderPageAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const existing = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, wedding.id))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));

  const ordered = moveId(
    existing.map((p) => p.id),
    id,
    direction,
  );
  await Promise.all(
    ordered.map((pid, position) =>
      db
        .update(schema.pages)
        .set({ position })
        .where(and(eq(schema.pages.id, pid), eq(schema.pages.weddingId, wedding.id))),
    ),
  );
  revalidateWedding();
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const redirectTo = text(formData, "redirectTo");
  if (!id) return;

  // Photo rows go with the page (cascade; the cover with the Home page) and
  // their files are deleted once that has committed.
  const photoFiles = await db.transaction(
    async (tx) => {
      const [page] = await tx
        .select({ type: schema.pages.type })
        .from(schema.pages)
        .where(and(eq(schema.pages.id, id), eq(schema.pages.weddingId, wedding.id)));
      if (!page) return [];
      const files = await photoFilesFor(tx, wedding.id, { pageId: id, pageType: page.type });
      if (page.type === "home") await deleteCoverRow(tx, wedding.id);
      await tx.delete(schema.pages).where(and(eq(schema.pages.id, id), eq(schema.pages.weddingId, wedding.id)));
      return files;
    },
    { behavior: "immediate" },
  );
  await deletePhotoFiles(photoFiles);

  const remaining = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, wedding.id))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));

  await Promise.all(
    remaining.map((p, position) =>
      db
        .update(schema.pages)
        .set({ position })
        .where(and(eq(schema.pages.id, p.id), eq(schema.pages.weddingId, wedding.id))),
    ),
  );

  revalidateWedding();
  if (redirectTo === "list") redirect("/admin/website");
}

function isPageVisibility(v: string): v is PageVisibility {
  return (PAGE_VISIBILITY as readonly string[]).includes(v);
}

export async function savePageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const pageId = text(formData, "pageId");
  if (!pageId) return fail("Page not found.");

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.id, pageId), eq(schema.pages.weddingId, wedding.id)))
    .limit(1);
  if (!page) return fail("Page not found.");

  const errors: Record<string, string> = {};
  const title = text(formData, "title");
  if (!title) errors.title = "Enter a page title.";

  const rawVisibility = text(formData, "visibility") ?? "public";
  const visibility: PageVisibility = isPageVisibility(rawVisibility) ? rawVisibility : "public";

  let audience = page.audience;
  if (visibility === "guests") {
    const parsed = readAudience(formData, "audience");
    if ("error" in parsed) {
      errors.audience = parsed.error;
    } else {
      audience = parsed;
    }
  }

  let slug = page.slug;
  if (page.type === "custom") {
    const rawSlug = text(formData, "slug") ?? "";
    const otherSlugs = (
      await db
        .select({ slug: schema.pages.slug })
        .from(schema.pages)
        .where(eq(schema.pages.weddingId, wedding.id))
    ).map((r) => r.slug);

    const validated = validateCustomSlug(rawSlug, otherSlugs, page.slug);
    if (!validated.ok) {
      errors.slug = validated.error;
    } else {
      slug = validated.slug;
    }
  }

  if (Object.keys(errors).length > 0) {
    return fail("Please fix the highlighted fields.", errors);
  }

  const body = text(formData, "body");

  await db
    .update(schema.pages)
    .set({
      title: title!,
      slug,
      body,
      visibility,
      audience,
    })
    .where(and(eq(schema.pages.id, page.id), eq(schema.pages.weddingId, wedding.id)));

  revalidateWedding();
  return ok("Page saved.");
}

function itemTitleError(type: PageType): string {
  switch (type) {
    case "story":
      return "Enter a heading.";
    case "party":
      return "Enter a name.";
    case "faq":
      return "Enter a question.";
    default:
      return "Enter a title.";
  }
}

export async function addPageItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const pageId = text(formData, "pageId");
  if (!pageId) return fail("Page not found.");

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.id, pageId), eq(schema.pages.weddingId, wedding.id)))
    .limit(1);
  if (!page || !PAGE_TYPE_META[page.type].hasItems) return fail("Page not found.");

  const title = text(formData, "title");
  if (!title) {
    return fail("Please fix the highlighted fields.", { title: itemTitleError(page.type) });
  }

  const subtitle = page.type === "party" ? text(formData, "subtitle") : null;
  const body = text(formData, "body");

  const existing = await db
    .select({ id: schema.pageItems.id })
    .from(schema.pageItems)
    .where(and(eq(schema.pageItems.pageId, page.id), eq(schema.pageItems.weddingId, wedding.id)));

  await db.insert(schema.pageItems).values({
    id: newId(),
    weddingId: wedding.id,
    pageId: page.id,
    title,
    subtitle,
    body,
    position: existing.length,
  });

  revalidateWedding();
  return ok("Entry added.");
}

export async function updatePageItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const pageId = text(formData, "pageId");
  const itemId = text(formData, "itemId");
  if (!pageId || !itemId) return fail("Entry not found.");

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.id, pageId), eq(schema.pages.weddingId, wedding.id)))
    .limit(1);
  if (!page || !PAGE_TYPE_META[page.type].hasItems) return fail("Page not found.");

  const title = text(formData, "title");
  if (!title) {
    return fail("Please fix the highlighted fields.", { title: itemTitleError(page.type) });
  }

  const subtitle = page.type === "party" ? text(formData, "subtitle") : null;
  const body = text(formData, "body");

  await db
    .update(schema.pageItems)
    .set({ title, subtitle, body })
    .where(
      and(
        eq(schema.pageItems.id, itemId),
        eq(schema.pageItems.pageId, page.id),
        eq(schema.pageItems.weddingId, wedding.id),
      ),
    );

  revalidateWedding();
  return ok("Entry saved.");
}

export async function deletePageItemAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const pageId = text(formData, "pageId");
  const itemId = text(formData, "itemId");
  if (!pageId || !itemId) return;

  const photoFiles = await db.transaction(
    async (tx) => {
      const files = await photoFilesFor(tx, wedding.id, { pageItemIds: [itemId] });
      const deleted = await tx
        .delete(schema.pageItems)
        .where(
          and(
            eq(schema.pageItems.id, itemId),
            eq(schema.pageItems.pageId, pageId),
            eq(schema.pageItems.weddingId, wedding.id),
          ),
        )
        .returning({ id: schema.pageItems.id });
      return deleted.length ? files : [];
    },
    { behavior: "immediate" },
  );
  await deletePhotoFiles(photoFiles);

  const remaining = await db
    .select({ id: schema.pageItems.id })
    .from(schema.pageItems)
    .where(and(eq(schema.pageItems.pageId, pageId), eq(schema.pageItems.weddingId, wedding.id)))
    .orderBy(asc(schema.pageItems.position), asc(schema.pageItems.createdAt));

  await Promise.all(
    remaining.map((item, position) =>
      db
        .update(schema.pageItems)
        .set({ position })
        .where(and(eq(schema.pageItems.id, item.id), eq(schema.pageItems.weddingId, wedding.id))),
    ),
  );

  revalidateWedding();
}

export async function reorderPageItemAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const pageId = text(formData, "pageId");
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!pageId || !id || (direction !== "up" && direction !== "down")) return;

  const existing = await db
    .select({ id: schema.pageItems.id })
    .from(schema.pageItems)
    .where(and(eq(schema.pageItems.pageId, pageId), eq(schema.pageItems.weddingId, wedding.id)))
    .orderBy(asc(schema.pageItems.position), asc(schema.pageItems.createdAt));

  const ordered = moveId(
    existing.map((i) => i.id),
    id,
    direction,
  );
  await Promise.all(
    ordered.map((itemId, position) =>
      db
        .update(schema.pageItems)
        .set({ position })
        .where(
          and(
            eq(schema.pageItems.id, itemId),
            eq(schema.pageItems.pageId, pageId),
            eq(schema.pageItems.weddingId, wedding.id),
          ),
        ),
    ),
  );

  revalidateWedding();
}
