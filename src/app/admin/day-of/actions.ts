"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { type ActionState, bool, fail, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { isClock } from "@/lib/planning";
import { revalidateWedding } from "@/lib/revalidate";

export async function saveRunItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const title = text(formData, "title");
  const time = text(formData, "time");
  const errors: Record<string, string> = {};
  if (!title) errors.title = "Say what happens.";
  if (time && !isClock(time)) errors.time = "Enter a time like 15:30.";
  if (Object.keys(errors).length > 0) return fail("Please fix the highlighted fields.", errors);

  const values = { title: title!, time, location: text(formData, "location"), who: text(formData, "who"), notes: text(formData, "notes") };
  if (id) {
    await db
      .update(schema.runSheetItems)
      .set(values)
      .where(and(eq(schema.runSheetItems.id, id), eq(schema.runSheetItems.weddingId, wedding.id)));
    revalidateWedding();
    return ok("Saved.");
  }
  await db.insert(schema.runSheetItems).values({ id: newId(), weddingId: wedding.id, ...values });
  revalidateWedding();
  return ok(`Added “${title}”.`);
}

export async function deleteRunItemAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.runSheetItems).where(and(eq(schema.runSheetItems.id, id), eq(schema.runSheetItems.weddingId, wedding.id)));
  revalidateWedding();
}

export async function saveSongAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (!title) return fail("Please fix the highlighted fields.", { title: "Enter the song." });
  const values = {
    title,
    artist: text(formData, "artist"),
    moment: text(formData, "moment"),
    doNotPlay: bool(formData, "doNotPlay"),
    notes: text(formData, "notes"),
  };
  if (id) {
    await db
      .update(schema.songs)
      .set(values)
      .where(and(eq(schema.songs.id, id), eq(schema.songs.weddingId, wedding.id)));
    revalidateWedding();
    return ok("Saved.");
  }
  const existing = await db.select({ id: schema.songs.id }).from(schema.songs).where(eq(schema.songs.weddingId, wedding.id));
  await db.insert(schema.songs).values({ id: newId(), weddingId: wedding.id, position: existing.length, ...values });
  revalidateWedding();
  return ok(`Added “${title}”.`);
}

export async function deleteSongAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.songs).where(and(eq(schema.songs.id, id), eq(schema.songs.weddingId, wedding.id)));
  revalidateWedding();
}
