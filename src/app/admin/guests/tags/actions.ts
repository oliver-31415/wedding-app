"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { deleteTag } from "@/lib/cleanup";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { newId } from "@/lib/ids";

export async function createTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const name = text(formData, "name");
  if (!name) return fail("Please fix the highlighted fields.", { name: "Enter a tag name." });
  if (name.length > 50) return fail("Please fix the highlighted fields.", { name: "Keep tag names under 50 characters." });

  const existing = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id));

  if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    return fail("Please fix the highlighted fields.", { name: "A tag with that name already exists." });
  }

  await db.insert(schema.tags).values({ id: newId(), weddingId: wedding.id, name });
  revalidatePath("/admin/guests/tags");
  revalidatePath("/admin/guests");
  revalidateWedding();
  return ok(`Tag “${name}” created.`);
}

export async function renameTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const tagId = text(formData, "tagId");
  const name = text(formData, "name");

  if (!tagId) return fail("Tag not found.");
  if (!name) return fail("Please fix the highlighted fields.", { name: "Enter a tag name." });
  if (name.length > 50) return fail("Please fix the highlighted fields.", { name: "Keep tag names under 50 characters." });

  const existing = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id));

  const target = existing.find((t) => t.id === tagId);
  if (!target) return fail("Tag not found.");

  if (existing.some((t) => t.id !== tagId && t.name.toLowerCase() === name.toLowerCase())) {
    return fail("Please fix the highlighted fields.", { name: "Another tag already has that name." });
  }

  await db
    .update(schema.tags)
    .set({ name })
    .where(and(eq(schema.tags.id, tagId), eq(schema.tags.weddingId, wedding.id)));

  revalidatePath("/admin/guests/tags");
  revalidatePath("/admin/guests");
  revalidateWedding();
  return ok("Tag renamed.");
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const tagId = text(formData, "tagId");
  if (!tagId) return;

  // Refuses while a page, event, question or draft is limited to this tag
  // (the tags page shows where, and disables Delete until it's free).
  await deleteTag(wedding.id, tagId);

  revalidatePath("/admin/guests/tags");
  revalidatePath("/admin/guests");
  revalidateWedding();
}
