"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { type ActionState, fail, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { revalidateWedding } from "@/lib/revalidate";
import { parseJobTimes } from "@/lib/run-sheet";

function revalidateJobs() {
  revalidatePath("/admin/day-of", "layout");
  revalidateWedding();
}

/** Adds or edits a job on a run sheet item, and sets who's doing it. */
export async function saveJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const itemId = text(formData, "itemId");
  const jobId = text(formData, "jobId");
  const [item] = itemId
    ? await db
        .select({ id: schema.runSheetItems.id })
        .from(schema.runSheetItems)
        .where(and(eq(schema.runSheetItems.id, itemId), eq(schema.runSheetItems.weddingId, wedding.id)))
        .limit(1)
    : [];
  if (!item) return fail("That run sheet item has been deleted. Reload the page.");

  const errors: Record<string, string> = {};
  const title = text(formData, "title");
  if (!title) errors.title = "Say what needs doing.";
  const times = parseJobTimes(text(formData, "startTime"), text(formData, "endTime"));
  if (!times.ok) Object.assign(errors, times.errors);
  if (Object.keys(errors).length || !times.ok || !title) return fail("Please fix the highlighted fields.", errors);
  const notes = text(formData, "notes");

  // Only this wedding's helpers can be put on a job.
  const helperIds = [...new Set(formData.getAll("helperIds").map(String).filter(Boolean))];
  if (helperIds.length) {
    const found = await db
      .select({ id: schema.helpers.id })
      .from(schema.helpers)
      .where(and(eq(schema.helpers.weddingId, wedding.id), inArray(schema.helpers.id, helperIds)));
    if (found.length !== helperIds.length) return fail("One of those helpers has been removed. Reload the page and try again.");
  }

  if (jobId) {
    const [existing] = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.weddingId, wedding.id), eq(schema.jobs.runSheetItemId, item.id)))
      .limit(1);
    if (!existing) return fail("That job has been deleted. Reload the page.");
  }

  const id = jobId ?? newId();
  await db.transaction(async (tx) => {
    if (jobId) {
      await tx
        .update(schema.jobs)
        .set({ title, notes, startTime: times.startTime, endTime: times.endTime })
        .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.weddingId, wedding.id)));
      await tx.delete(schema.jobHelpers).where(eq(schema.jobHelpers.jobId, jobId));
    } else {
      const siblings = await tx
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.weddingId, wedding.id), eq(schema.jobs.runSheetItemId, item.id)));
      await tx.insert(schema.jobs).values({
        id,
        weddingId: wedding.id,
        runSheetItemId: item.id,
        title,
        notes,
        startTime: times.startTime,
        endTime: times.endTime,
        position: siblings.length,
      });
    }
    if (helperIds.length) await tx.insert(schema.jobHelpers).values(helperIds.map((helperId) => ({ jobId: id, helperId })));
  });

  revalidateJobs();
  return ok(jobId ? "Job saved." : "Job added.");
}

export async function deleteJobAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.jobs).where(and(eq(schema.jobs.id, id), eq(schema.jobs.weddingId, wedding.id)));
  revalidateJobs();
}
