"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { archiveQuestion as archiveQuestionTree, deleteOrArchiveQuestion } from "@/lib/cleanup";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import {
  bool,
  fail,
  moveId,
  ok,
  readAudience,
  text,
  type ActionState,
} from "@/lib/forms";
import { newId } from "@/lib/ids";
import { chainOrder } from "@/lib/rsvp/model";
import {
  parseOptionsJson,
  validateQuestionInput,
} from "@/lib/rsvp-admin/validation";

async function loadQuestionContext(weddingId: string, editingId: string | null) {
  const [allQuestions, events, weddingTags, existingAnswers] = await Promise.all([
    db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.weddingId, weddingId))
      .orderBy(asc(schema.questions.position), asc(schema.questions.createdAt)),
    db
      .select({
        id: schema.events.id,
        name: schema.events.name,
        rsvpEnabled: schema.events.rsvpEnabled,
      })
      .from(schema.events)
      .where(eq(schema.events.weddingId, weddingId))
      .orderBy(asc(schema.events.position)),
    db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, weddingId)),
    editingId
      ? db
          .select({ value: schema.answers.value })
          .from(schema.answers)
          .where(
            and(
              eq(schema.answers.weddingId, weddingId),
              eq(schema.answers.questionId, editingId),
            ),
          )
      : Promise.resolve([]),
  ]);

  const editing = editingId
    ? (allQuestions.find((q) => q.id === editingId) ?? null)
    : null;
  const childQuestions = editingId
    ? allQuestions.filter((q) => q.parentQuestionId === editingId)
    : [];
  const answeredOptionIds = new Set(existingAnswers.map((a) => a.value));

  return {
    editing,
    allQuestions,
    events,
    validTagIds: new Set(weddingTags.map((t) => t.id)),
    answeredOptionIds,
    answerCount: existingAnswers.length,
    childQuestions,
  };
}

/** Renumbers active questions 0…n in the order guests see them (follow-ups after their question). */
async function normaliseActivePositions(weddingId: string) {
  const active = chainOrder(
    await db
      .select({
        id: schema.questions.id,
        parentQuestionId: schema.questions.parentQuestionId,
        position: schema.questions.position,
      })
      .from(schema.questions)
      .where(and(eq(schema.questions.weddingId, weddingId), eq(schema.questions.archived, false)))
      .orderBy(asc(schema.questions.position), asc(schema.questions.createdAt)),
  );

  for (let i = 0; i < active.length; i++) {
    await db
      .update(schema.questions)
      .set({ position: i })
      .where(
        and(
          eq(schema.questions.id, active[i].id),
          eq(schema.questions.weddingId, weddingId),
        ),
      );
  }
}

function revalidateRsvp(slug: string, questionId?: string) {
  revalidateWedding();
  revalidatePath("/admin/rsvp");
  revalidatePath("/admin/rsvp/questions");
  if (questionId) revalidatePath(`/admin/rsvp/questions/${questionId}`);
}

export async function createQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();
  const ctx = await loadQuestionContext(wedding.id, null);

  const result = validateQuestionInput(
    {
      label: text(formData, "label"),
      type: text(formData, "type"),
      options: parseOptionsJson(text(formData, "optionsJson")),
      required: bool(formData, "required"),
      scope: text(formData, "scope"),
      eventId: text(formData, "eventId"),
      parentQuestionId: text(formData, "parentQuestionId"),
      parentOptionId: text(formData, "parentOptionId"),
      audience: readAudience(formData, "audience"),
    },
    {
      ...ctx,
      generateOptionId: newId,
    },
  );

  if (!result.ok) {
    return fail(result.message, result.errors);
  }

  const activeCount = ctx.allQuestions.filter((q) => !q.archived).length;
  const id = newId();

  await db.insert(schema.questions).values({
    id,
    weddingId: wedding.id,
    type: result.value.type,
    label: result.value.label,
    options: result.value.options,
    required: result.value.required,
    scope: result.value.scope,
    eventId: result.value.eventId,
    parentQuestionId: result.value.parentQuestionId,
    parentOptionId: result.value.parentOptionId,
    audience: result.value.audience,
    archived: false,
    position: activeCount,
  });
  await normaliseActivePositions(wedding.id);

  revalidateRsvp(wedding.slug);
  redirect("/admin/rsvp/questions");
}

export async function updateQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return fail("Question not found.");

  const ctx = await loadQuestionContext(wedding.id, id);
  if (!ctx.editing) return fail("Question not found.");

  const result = validateQuestionInput(
    {
      label: text(formData, "label"),
      type: text(formData, "type"),
      options: parseOptionsJson(text(formData, "optionsJson")),
      required: bool(formData, "required"),
      scope: text(formData, "scope"),
      eventId: text(formData, "eventId"),
      parentQuestionId: text(formData, "parentQuestionId"),
      parentOptionId: text(formData, "parentOptionId"),
      audience: readAudience(formData, "audience"),
    },
    {
      ...ctx,
      generateOptionId: newId,
    },
  );

  if (!result.ok) {
    return fail(result.message, result.errors);
  }

  await db
    .update(schema.questions)
    .set({
      type: result.value.type,
      label: result.value.label,
      options: result.value.options,
      required: result.value.required,
      scope: result.value.scope,
      eventId: result.value.eventId,
      parentQuestionId: result.value.parentQuestionId,
      parentOptionId: result.value.parentOptionId,
      audience: result.value.audience,
    })
    .where(
      and(eq(schema.questions.id, id), eq(schema.questions.weddingId, wedding.id)),
    );

  await normaliseActivePositions(wedding.id);
  revalidateRsvp(wedding.slug, id);
  return ok("Question saved.");
}

/**
 * Moves a question up or down among its siblings (questions that follow up the
 * same question, or the top-level ones), carrying its follow-ups with it.
 */
export async function reorderQuestion(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const active = chainOrder(
    await db
      .select({
        id: schema.questions.id,
        parentQuestionId: schema.questions.parentQuestionId,
        position: schema.questions.position,
      })
      .from(schema.questions)
      .where(and(eq(schema.questions.weddingId, wedding.id), eq(schema.questions.archived, false))),
  );
  const ids = new Set(active.map((q) => q.id));
  const parentOf = (q: (typeof active)[number]) => (q.parentQuestionId && ids.has(q.parentQuestionId) ? q.parentQuestionId : null);
  const moving = active.find((q) => q.id === id);
  if (!moving) return;
  const siblings = active.filter((q) => parentOf(q) === parentOf(moving)).map((q) => q.id);
  const reordered = moveId(siblings, id, direction);
  const siblingRank = new Map(reordered.map((sid, i) => [sid, i]));

  // Siblings take their new ranks; then every active question is renumbered in chain order.
  const next = chainOrder(active.map((q) => (siblingRank.has(q.id) ? { ...q, position: siblingRank.get(q.id)! } : q)));
  for (let i = 0; i < next.length; i++) {
    await db
      .update(schema.questions)
      .set({ position: i })
      .where(and(eq(schema.questions.id, next[i].id), eq(schema.questions.weddingId, wedding.id)));
  }

  revalidateRsvp(wedding.slug);
}

/** Deletes the question and its follow-ups if none have answers; otherwise archives them all. */
async function performDelete(weddingId: string, id: string): Promise<boolean> {
  const result = await deleteOrArchiveQuestion(weddingId, id);
  await normaliseActivePositions(weddingId);
  return result === "deleted";
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await performDelete(wedding.id, id);
  revalidateRsvp(wedding.slug, id);
}

export async function deleteQuestionAndRedirect(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  const deleted = await performDelete(wedding.id, id);
  revalidateRsvp(wedding.slug, id);
  if (deleted) redirect("/admin/rsvp/questions");
}

export async function archiveQuestion(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  // Follow-ups can't be asked without their parent, so they're archived too.
  await archiveQuestionTree(wedding.id, id);
  await normaliseActivePositions(wedding.id);
  revalidateRsvp(wedding.slug, id);
}

export async function archiveQuestionAndRedirect(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  // Follow-ups can't be asked without their parent, so they're archived too.
  await archiveQuestionTree(wedding.id, id);
  await normaliseActivePositions(wedding.id);
  revalidateRsvp(wedding.slug, id);
  redirect("/admin/rsvp/questions");
}

export async function restoreQuestion(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  const active = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.weddingId, wedding.id),
        eq(schema.questions.archived, false),
      ),
    );

  await db
    .update(schema.questions)
    .set({ archived: false, position: active.length })
    .where(
      and(eq(schema.questions.id, id), eq(schema.questions.weddingId, wedding.id)),
    );
  await normaliseActivePositions(wedding.id);
  revalidateRsvp(wedding.slug, id);
}
