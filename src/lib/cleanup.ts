import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Audience } from "@/db/schema";

/**
 * Deletes that touch more than one table. Use these instead of deleting rows
 * directly, so RSVP answers and invitations never silently disappear.
 */

const usesTag = (a: Audience, tagId: string) => a.mode === "tags" && a.tagIds.includes(tagId);

export type TagUsage = { pages: string[]; events: string[]; questions: string[]; drafts: string[] };

/** Everything that limits who sees / is invited / is asked by this tag. */
export async function tagUsage(weddingId: string, tagId: string): Promise<TagUsage> {
  const [pages, events, questions, messages] = await Promise.all([
    db.select({ name: schema.pages.title, audience: schema.pages.audience }).from(schema.pages).where(eq(schema.pages.weddingId, weddingId)),
    db.select({ name: schema.events.name, audience: schema.events.audience }).from(schema.events).where(eq(schema.events.weddingId, weddingId)),
    db
      .select({ name: schema.questions.label, audience: schema.questions.audience, archived: schema.questions.archived })
      .from(schema.questions)
      .where(eq(schema.questions.weddingId, weddingId)),
    db
      .select({ name: schema.messages.subject, recipients: schema.messages.recipients, status: schema.messages.status })
      .from(schema.messages)
      .where(eq(schema.messages.weddingId, weddingId)),
  ]);
  return {
    pages: pages.filter((p) => usesTag(p.audience, tagId)).map((p) => p.name),
    events: events.filter((e) => usesTag(e.audience, tagId)).map((e) => e.name),
    questions: questions.filter((q) => !q.archived && usesTag(q.audience, tagId)).map((q) => q.name),
    drafts: messages.filter((m) => m.status === "draft" && usesTag(m.recipients.audience, tagId)).map((m) => m.name || "Untitled"),
  };
}

export const tagInUse = (u: TagUsage) => u.pages.length + u.events.length + u.questions.length + u.drafts.length > 0;

/**
 * Deletes a tag only when nothing limits by it — otherwise returns where it's
 * used so the couple can change those first (deleting it would silently
 * uninvite people).
 */
export async function deleteTag(weddingId: string, tagId: string): Promise<{ ok: true } | { ok: false; usage: TagUsage }> {
  const usage = await tagUsage(weddingId, tagId);
  if (tagInUse(usage)) return { ok: false, usage };
  await db.delete(schema.tags).where(and(eq(schema.tags.id, tagId), eq(schema.tags.weddingId, weddingId)));
  return { ok: true };
}

/** Deletes an event and its RSVPs; questions tied to it are archived (answers kept). */
export async function deleteEvent(weddingId: string, eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const tied = await tx
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(eq(schema.questions.weddingId, weddingId), eq(schema.questions.eventId, eventId)));
    const ids = await withFollowUps(tx, weddingId, tied.map((q) => q.id));
    if (ids.length) {
      await tx.update(schema.questions).set({ archived: true }).where(and(eq(schema.questions.weddingId, weddingId), inArray(schema.questions.id, ids)));
    }
    await tx.delete(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.weddingId, weddingId)));
  });
}

/** Archives a question and every follow-up beneath it (they can't be asked without it). */
export async function archiveQuestion(weddingId: string, questionId: string): Promise<void> {
  const ids = await withFollowUps(db, weddingId, [questionId]);
  await db.update(schema.questions).set({ archived: true }).where(and(eq(schema.questions.weddingId, weddingId), inArray(schema.questions.id, ids)));
}

/**
 * Deletes a question if neither it nor its follow-ups have answers; otherwise
 * archives the lot. Returns what happened so the UI can say so.
 */
export async function deleteOrArchiveQuestion(weddingId: string, questionId: string): Promise<"deleted" | "archived"> {
  const ids = await withFollowUps(db, weddingId, [questionId]);
  const [answered] = await db
    .select({ id: schema.answers.id })
    .from(schema.answers)
    .where(and(eq(schema.answers.weddingId, weddingId), inArray(schema.answers.questionId, ids)))
    .limit(1);
  if (answered) {
    await archiveQuestion(weddingId, questionId);
    return "archived";
  }
  await db.delete(schema.questions).where(and(eq(schema.questions.weddingId, weddingId), inArray(schema.questions.id, ids)));
  return "deleted";
}

/** `ids` plus all their follow-up questions, recursively. */
async function withFollowUps(reader: Pick<typeof db, "select">, weddingId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const all = await reader
    .select({ id: schema.questions.id, parent: schema.questions.parentQuestionId })
    .from(schema.questions)
    .where(eq(schema.questions.weddingId, weddingId));
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const q of all) {
      if (q.parent && out.has(q.parent) && !out.has(q.id)) {
        out.add(q.id);
        grew = true;
      }
    }
  }
  return [...out];
}
