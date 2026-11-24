import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "@/lib/ids";
import { householdSlice, loadSnapshot } from "@/lib/snapshot";
import {
  answerKey,
  attendanceKey,
  householdRsvpState,
  responsesMap,
  rsvpWindow,
  validateSubmission,
  type SnapAnswer,
  type SnapResponse,
  type SubmissionInput,
} from "./model";

export type SaveRsvpResult =
  | { ok: true; firstResponse: boolean }
  | { ok: false; errors: Record<string, string>; message?: string };

class Rejected extends Error {
  constructor(readonly result: Extract<SaveRsvpResult, { ok: false }>) {
    super(result.message);
  }
}

/**
 * The only way RSVP data is written — by guests on the site and by hosts in
 * the admin. Everything (read, validate, write) happens in one write
 * transaction, so double-clicks and two partners replying at once can't
 * exceed the plus-one allowance or interleave.
 *
 * Only the *current* RSVP set is replaced: answers to archived questions and
 * responses for events that no longer collect RSVPs are left untouched.
 *
 * When the couple turns off "let guests change their RSVP", guests can still
 * answer anything new (e.g. an event added later) but what they already
 * answered is locked to the stored values.
 */
export async function saveRsvp(args: {
  weddingId: string;
  householdId: string;
  input: SubmissionInput;
  source: "guest" | "host";
}): Promise<SaveRsvpResult> {
  try {
    return await db.transaction(
      async (tx) => {
        const [wedding] = await tx.select().from(schema.weddings).where(eq(schema.weddings.id, args.weddingId));
        if (!wedding) throw new Rejected({ ok: false, errors: {}, message: "Wedding not found." });

        const snapshot = await loadSnapshot(args.weddingId, tx);
        const slice = householdSlice(snapshot, args.householdId);
        if (!slice) throw new Rejected({ ok: false, errors: {}, message: "We couldn't find that invitation." });

        const [previous] = await tx
          .select({ id: schema.rsvpActivity.id })
          .from(schema.rsvpActivity)
          .where(eq(schema.rsvpActivity.householdId, args.householdId))
          .limit(1);
        const firstResponse = !previous && slice.responses.length === 0;

        const activeEventIds = snapshot.events.filter((e) => e.rsvpEnabled).map((e) => e.id);
        const activeQuestionIds = snapshot.questions.filter((q) => !q.archived).map((q) => q.id);

        let input = args.input;
        if (args.source === "guest") {
          const window = rsvpWindow(wedding);
          if (!window.open) throw new Rejected({ ok: false, errors: {}, message: "RSVPs are closed." });
          if (!wedding.rsvpAllowEdits && !firstResponse) {
            if (householdRsvpState(slice.guests, snapshot.events, responsesMap(slice.responses)) === "complete") {
              throw new Rejected({ ok: false, errors: {}, message: "Your RSVP is already in. Contact the couple to change it." });
            }
            input = lockAnswered(input, slice.responses.filter((r) => activeEventIds.includes(r.eventId)), slice.answers, slice.guests);
          }
        }

        const result = validateSubmission(input, {
          household: slice.household,
          guests: slice.guests,
          events: snapshot.events,
          questions: snapshot.questions,
          mode: args.source,
        });
        if (!result.ok) {
          throw new Rejected({ ok: false, errors: result.errors, message: "Please check the highlighted answers." });
        }
        const v = result.value;
        const now = new Date();

        // plus-ones: real ids for new ones, then rename kept, delete removed
        const idFor = new Map<string, string>();
        for (const [i, p] of v.plusOnes.add.entries()) {
          const id = newId();
          idFor.set(p.tempId, id);
          await tx.insert(schema.guests).values({
            id,
            weddingId: args.weddingId,
            householdId: args.householdId,
            firstName: p.firstName,
            lastName: p.lastName,
            isPlusOne: true,
            position: slice.guests.length + i,
          });
        }
        const inHousehold = and(eq(schema.guests.householdId, args.householdId), eq(schema.guests.weddingId, args.weddingId));
        for (const p of v.plusOnes.keep) {
          await tx
            .update(schema.guests)
            .set({ firstName: p.firstName, lastName: p.lastName })
            .where(and(eq(schema.guests.id, p.id), inHousehold));
        }
        if (v.plusOnes.remove.length) {
          await tx.delete(schema.guests).where(and(inArray(schema.guests.id, v.plusOnes.remove), inHousehold));
        }
        const realId = (id: string) => idFor.get(id) ?? id;

        // Replace the household's current RSVP set.
        const guestIds = slice.guests.map((g) => g.id).filter((id) => !v.plusOnes.remove.includes(id));
        if (guestIds.length && activeEventIds.length) {
          await tx
            .delete(schema.eventResponses)
            .where(
              and(
                eq(schema.eventResponses.weddingId, args.weddingId),
                inArray(schema.eventResponses.guestId, guestIds),
                inArray(schema.eventResponses.eventId, activeEventIds),
              ),
            );
        }
        if (activeQuestionIds.length) {
          const scoped = and(eq(schema.answers.weddingId, args.weddingId), inArray(schema.answers.questionId, activeQuestionIds));
          if (guestIds.length) await tx.delete(schema.answers).where(and(scoped, inArray(schema.answers.guestId, guestIds)));
          await tx
            .delete(schema.answers)
            .where(and(scoped, isNull(schema.answers.guestId), eq(schema.answers.householdId, args.householdId)));
        }
        if (v.attendance.length) {
          await tx.insert(schema.eventResponses).values(
            v.attendance.map((a) => ({
              weddingId: args.weddingId,
              guestId: realId(a.guestId),
              eventId: a.eventId,
              attending: a.attending,
              updatedAt: now,
            })),
          );
        }
        if (v.answers.length) {
          await tx.insert(schema.answers).values(
            v.answers.map((a) => ({
              id: newId(),
              weddingId: args.weddingId,
              questionId: a.questionId,
              guestId: a.guestId ? realId(a.guestId) : null,
              householdId: a.guestId ? null : args.householdId,
              value: a.value,
              updatedAt: now,
            })),
          );
        }

        await tx.insert(schema.rsvpActivity).values({
          id: newId(),
          weddingId: args.weddingId,
          householdId: args.householdId,
          source: args.source,
          kind: firstResponse ? "first" : "update",
          note: v.note,
        });

        return { ok: true as const, firstResponse };
      },
      { behavior: "immediate" },
    );
  } catch (e) {
    if (e instanceof Rejected) return e.result;
    throw e;
  }
}

/**
 * Overrides the submission with what's already stored for every answered
 * (guest, event) pair and question, and keeps existing plus-ones — used when
 * the couple doesn't allow changes but new things still need answers.
 */
function lockAnswered(
  input: SubmissionInput,
  responses: SnapResponse[],
  answers: SnapAnswer[],
  guests: { id: string; firstName: string; lastName: string; isPlusOne: boolean }[],
): SubmissionInput {
  const stored = new Map(responses.map((r) => [attendanceKey(r.guestId, r.eventId), r.attending]));
  const storedAnswers = new Map(answers.map((a) => [answerKey(a.questionId, a.guestId), a]));
  const attendance = [
    ...responses.map((r) => ({ guestId: r.guestId, eventId: r.eventId, attending: r.attending })),
    ...input.attendance.filter((a) => !stored.has(attendanceKey(a.guestId, a.eventId))),
  ];
  const answerList = [
    ...answers.map((a) => ({ questionId: a.questionId, guestId: a.guestId, value: a.value })),
    ...input.answers.filter((a) => !storedAnswers.has(answerKey(a.questionId, a.guestId))),
  ];
  const existingPlusOnes = guests.filter((g) => g.isPlusOne);
  const plusOnes = [
    ...existingPlusOnes.map((g) => ({ id: g.id, firstName: g.firstName, lastName: g.lastName })),
    ...input.plusOnes.filter((p) => !existingPlusOnes.some((g) => g.id === p.id)),
  ];
  return { ...input, attendance, answers: answerList, plusOnes };
}
