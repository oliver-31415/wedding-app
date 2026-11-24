import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import type { SnapGuest } from "@/lib/rsvp/model";

export const getWeddingBySlug = cache(async (slug: string) => {
  const [wedding] = await db
    .select()
    .from(schema.weddings)
    .where(eq(schema.weddings.slug, slug))
    .limit(1);
  return wedding ?? null;
});

export const getWeddingPages = cache(async (weddingId: string) => {
  return db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, weddingId))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));
});

export const getViewerHouseholdGuests = cache(
  async (weddingId: string, householdId: string | null): Promise<SnapGuest[]> => {
    if (!householdId) return [];

    const guests = await db
      .select()
      .from(schema.guests)
      .where(
        and(eq(schema.guests.weddingId, weddingId), eq(schema.guests.householdId, householdId)),
      )
      .orderBy(asc(schema.guests.position), asc(schema.guests.createdAt));

    if (guests.length === 0) return [];

    const guestTags = await db
      .select({ guestId: schema.guestTags.guestId, tagId: schema.guestTags.tagId })
      .from(schema.guestTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.guestTags.tagId))
      .where(eq(schema.tags.weddingId, weddingId));

    const tagsByGuest = new Map<string, string[]>();
    for (const { guestId, tagId } of guestTags) {
      const list = tagsByGuest.get(guestId);
      if (list) list.push(tagId);
      else tagsByGuest.set(guestId, [tagId]);
    }

    return guests.map((g) => ({
      id: g.id,
      householdId: g.householdId,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      ageGroup: g.ageGroup,
      isPlusOne: g.isPlusOne,
      tagIds: tagsByGuest.get(g.id) ?? [],
    }));
  },
);

export const getWeddingEvents = cache(async (weddingId: string) => {
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.weddingId, weddingId))
    .orderBy(asc(schema.events.position), asc(schema.events.createdAt));
});

export const getWeddingTagNames = cache(async (weddingId: string) => {
  const rows = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, weddingId));
  return new Map(rows.map((r) => [r.id, r.name]));
});

export const getPageItems = cache(async (weddingId: string, pageId: string) => {
  return db
    .select()
    .from(schema.pageItems)
    .where(and(eq(schema.pageItems.weddingId, weddingId), eq(schema.pageItems.pageId, pageId)))
    .orderBy(asc(schema.pageItems.position), asc(schema.pageItems.createdAt));
});
