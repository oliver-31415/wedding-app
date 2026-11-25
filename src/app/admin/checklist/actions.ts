"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { type ActionState, fail, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { isDate, suggestedTasks } from "@/lib/planning";
import { loadHosts } from "@/lib/planning-data";
import { revalidateWedding } from "@/lib/revalidate";

async function readAssignee(weddingId: string, formData: FormData): Promise<string | null | undefined> {
  const raw = text(formData, "assigneeId");
  if (!raw) return null;
  const hosts = await loadHosts(weddingId);
  return hosts.some((h) => h.id === raw) ? raw : undefined;
}

export async function saveTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const title = text(formData, "title");
  const dueDate = text(formData, "dueDate");
  const assigneeId = await readAssignee(wedding.id, formData);

  const errors: Record<string, string> = {};
  if (!title) errors.title = "Enter a task.";
  else if (title.length > 200) errors.title = "Keep it under 200 characters.";
  if (dueDate && !isDate(dueDate)) errors.dueDate = "Enter a valid date.";
  if (assigneeId === undefined) errors.assigneeId = "Choose someone from your hosts.";
  if (Object.keys(errors).length > 0) return fail("Please fix the highlighted fields.", errors);

  const values = { title: title!, dueDate, assigneeId: assigneeId ?? null, notes: text(formData, "notes") };
  if (id) {
    await db
      .update(schema.tasks)
      .set(values)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.weddingId, wedding.id)));
    revalidateWedding();
    return ok("Saved.");
  }
  await db.insert(schema.tasks).values({ id: newId(), weddingId: wedding.id, ...values });
  revalidateWedding();
  return ok(`Added “${title}”.`);
}

export async function toggleTaskAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  const [task] = await db
    .select({ doneAt: schema.tasks.doneAt })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.weddingId, wedding.id)))
    .limit(1);
  if (!task) return;
  await db
    .update(schema.tasks)
    .set({ doneAt: task.doneAt ? null : new Date() })
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.weddingId, wedding.id)));
  revalidateWedding();
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.weddingId, wedding.id)));
  revalidateWedding();
}

export async function addSuggestedTasksAction(): Promise<void> {
  const { wedding } = await requireHost();
  const existing = await db
    .select({ title: schema.tasks.title })
    .from(schema.tasks)
    .where(eq(schema.tasks.weddingId, wedding.id));
  const toAdd = suggestedTasks(
    wedding.date,
    todayIn(wedding.timeZone),
    existing.map((t) => t.title),
  );
  if (toAdd.length > 0) {
    await db.insert(schema.tasks).values(toAdd.map((t) => ({ id: newId(), weddingId: wedding.id, title: t.title, dueDate: t.dueDate })));
  }
  revalidateWedding();
}
