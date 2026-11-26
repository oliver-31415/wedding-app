"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { type ActionState, bool, fail, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { isClock } from "@/lib/planning";
import { revalidateWedding } from "@/lib/revalidate";
import { deleteUpload, saveUploadedPdf } from "@/lib/uploads";

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
  const sheets = await db
    .select({ url: schema.songParts.sheetUrl })
    .from(schema.songParts)
    .where(and(eq(schema.songParts.songId, id), eq(schema.songParts.weddingId, wedding.id), isNotNull(schema.songParts.sheetUrl)));
  // Deleting the song deletes its instruments too (cascade); their PDFs go with them.
  await db.delete(schema.songs).where(and(eq(schema.songs.id, id), eq(schema.songs.weddingId, wedding.id)));
  for (const s of sheets) await deleteUpload(s.url);
  revalidateWedding();
}

/** Adds an instrument to a song, or renames one; a chosen PDF becomes (or replaces) its sheet music. */
export async function savePartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const instrument = text(formData, "instrument");
  if (!instrument) return fail("Please fix the highlighted fields.", { instrument: "Enter the instrument." });
  const sheet = formData.get("sheet");
  const hasSheet = sheet instanceof File && sheet.size > 0;

  const [part] = id
    ? await db
        .select()
        .from(schema.songParts)
        .where(and(eq(schema.songParts.id, id), eq(schema.songParts.weddingId, wedding.id)))
        .limit(1)
    : [null];
  if (id && !part) return fail("That instrument has been removed.");
  const songId = part?.songId ?? text(formData, "songId");
  const [song] = songId
    ? await db
        .select({ id: schema.songs.id })
        .from(schema.songs)
        .where(and(eq(schema.songs.id, songId), eq(schema.songs.weddingId, wedding.id)))
        .limit(1)
    : [];
  if (!song) return fail("That song has been removed.");

  let upload: { url: string; name: string } | null = null;
  if (hasSheet) {
    const saved = await saveUploadedPdf(sheet);
    if (!saved.ok) return fail("Please fix the highlighted fields.", { sheet: saved.error });
    upload = { url: saved.url, name: sheet.name.slice(0, 200) || "Sheet music.pdf" };
  }
  const values = { instrument, ...(upload && { sheetUrl: upload.url, sheetName: upload.name }) };

  try {
    if (part) {
      await db.update(schema.songParts).set(values).where(eq(schema.songParts.id, part.id));
    } else {
      const existing = await db.select({ id: schema.songParts.id }).from(schema.songParts).where(eq(schema.songParts.songId, song.id));
      await db.insert(schema.songParts).values({ id: newId(), weddingId: wedding.id, songId: song.id, position: existing.length, ...values });
    }
  } catch (e) {
    await deleteUpload(upload?.url);
    throw e;
  }
  if (upload) await deleteUpload(part?.sheetUrl);
  revalidateWedding();
  return ok(part ? "Saved." : `Added ${instrument}.`);
}

export async function removeSheetAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  const where = and(eq(schema.songParts.id, id), eq(schema.songParts.weddingId, wedding.id));
  const [part] = await db.select({ url: schema.songParts.sheetUrl }).from(schema.songParts).where(where).limit(1);
  if (!part) return;
  await db.update(schema.songParts).set({ sheetUrl: null, sheetName: null }).where(where);
  await deleteUpload(part.url);
  revalidateWedding();
}

export async function deletePartAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  const where = and(eq(schema.songParts.id, id), eq(schema.songParts.weddingId, wedding.id));
  const [part] = await db.select({ url: schema.songParts.sheetUrl }).from(schema.songParts).where(where).limit(1);
  if (!part) return;
  await db.delete(schema.songParts).where(where);
  await deleteUpload(part.url);
  revalidateWedding();
}
