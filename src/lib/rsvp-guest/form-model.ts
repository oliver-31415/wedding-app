/**
 * Pure state-building, submission-mapping and error-ordering helpers for the
 * guest RSVP form. All RSVP business rules (eligibility, visibility, validation)
 * are delegated to `@/lib/rsvp/model`.
 */
import {
  answerKey,
  attendanceKey,
  guestName,
  rsvpEventsFor,
  rsvpEventsForHousehold,
  visibleQuestions,
  type Draft,
  type PlusOneInput,
  type SnapAnswer,
  type SnapEvent,
  type SnapGuest,
  type SnapQuestion,
  type SnapResponse,
  type SubmissionInput,
} from "@/lib/rsvp/model";

export type EventDetail = SnapEvent & {
  startsAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
};

export type GuestFormState = {
  plusOnes: PlusOneInput[];
  /** key `${guestId}:${eventId}` -> attending */
  attendance: Record<string, boolean>;
  /** key `${questionId}:${guestId}` or `${questionId}:household` -> value */
  answers: Record<string, string>;
  note: string;
};

export function buildInitialFormState(
  guests: SnapGuest[],
  responses: SnapResponse[],
  answers: SnapAnswer[],
  latestNote: string | null,
): GuestFormState {
  const plusOnes: PlusOneInput[] = guests
    .filter((g) => g.isPlusOne)
    .map((g) => ({ id: g.id, firstName: g.firstName, lastName: g.lastName }));

  const attendance: Record<string, boolean> = {};
  for (const r of responses) {
    attendance[attendanceKey(r.guestId, r.eventId)] = r.attending;
  }

  const answerRecord: Record<string, string> = {};
  for (const a of answers) {
    answerRecord[answerKey(a.questionId, a.guestId)] = a.value;
  }

  return {
    plusOnes,
    attendance,
    answers: answerRecord,
    note: latestNote ?? "",
  };
}

/**
 * Combines named household guests with the current plus-one rows so
 * `rsvpEventsFor` and `visibleQuestions` evaluate identically to `validateSubmission`.
 */
export function buildVirtualGuests(
  mainGuests: SnapGuest[],
  plusOnes: PlusOneInput[],
  householdId: string,
): SnapGuest[] {
  const named = mainGuests.filter((g) => !g.isPlusOne);
  const extras: SnapGuest[] = plusOnes.map((p) => ({
    id: p.id,
    householdId,
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email: null,
    ageGroup: "adult",
    isPlusOne: true,
    tagIds: [],
  }));
  return [...named, ...extras];
}

export function nextPlusOneTempId(plusOnes: { id: string }[]): string {
  const existing = new Set(plusOnes.map((p) => p.id));
  let n = 1;
  while (existing.has(`new-${n}`)) n++;
  return `new-${n}`;
}

export function displayGuestName(guest: { firstName: string; lastName: string; isPlusOne?: boolean }, index?: number): string {
  const full = guestName(guest);
  if (full) return full;
  if (guest.isPlusOne) return index !== undefined ? `Additional guest ${index + 1}` : "Additional guest";
  return "Guest";
}

export function buildDraft(
  attendance: Record<string, boolean>,
  answers: Record<string, string>,
): Draft {
  return {
    attendance: new Map(Object.entries(attendance)),
    answers: new Map(Object.entries(answers)),
  };
}

export function toSubmissionInput(state: GuestFormState): SubmissionInput {
  const attendance: SubmissionInput["attendance"] = [];
  for (const [key, attending] of Object.entries(state.attendance)) {
    const sep = key.indexOf(":");
    if (sep <= 0) continue;
    const guestId = key.slice(0, sep);
    const eventId = key.slice(sep + 1);
    if (guestId && eventId) attendance.push({ guestId, eventId, attending });
  }

  const answers: SubmissionInput["answers"] = [];
  for (const [key, value] of Object.entries(state.answers)) {
    const sep = key.indexOf(":");
    if (sep <= 0) continue;
    const questionId = key.slice(0, sep);
    const target = key.slice(sep + 1);
    if (!questionId || !target) continue;
    answers.push({
      questionId,
      guestId: target === "household" ? null : target,
      value,
    });
  }

  return {
    plusOnes: state.plusOnes.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
    })),
    attendance,
    answers,
    note: state.note.trim() || null,
  };
}

/** Remove any attendance/answers entries belonging to a removed plus-one id. */
export function pruneGuestFromFormState(state: GuestFormState, removedGuestId: string): GuestFormState {
  const attendance: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(state.attendance)) {
    if (!k.startsWith(`${removedGuestId}:`)) attendance[k] = v;
  }
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(state.answers)) {
    if (!k.endsWith(`:${removedGuestId}`)) answers[k] = v;
  }
  return {
    ...state,
    plusOnes: state.plusOnes.filter((p) => p.id !== removedGuestId),
    attendance,
    answers,
  };
}

/** Deterministic DOM id for every error key returned by `validateSubmission`. */
export function errorDomId(errorKey: string): string {
  return `rsvp-field-${errorKey.replace(/\./g, "-")}`;
}

/**
 * Returns error keys in top-to-bottom visual order on the RSVP form so
 * scrolling to the first error lands on the topmost invalid field.
 */
export function orderedFormErrorKeys(ctx: {
  plusOnesCount: number;
  virtualGuests: SnapGuest[];
  events: SnapEvent[];
  questions: SnapQuestion[];
  draft: Draft;
}): string[] {
  const keys: string[] = [];

  // 1. Plus-ones section
  keys.push("plusOnes");
  for (let i = 0; i < ctx.plusOnesCount; i++) {
    keys.push(`plusOne.${i}`);
  }

  // 2. Events in schedule order -> invited guests in household order
  const rsvpEvents = rsvpEventsForHousehold(ctx.virtualGuests, ctx.events);
  for (const event of rsvpEvents) {
    for (const guest of ctx.virtualGuests) {
      if (rsvpEventsFor(guest, [event], ctx.virtualGuests).length > 0) {
        keys.push(`attendance.${guest.id}.${event.id}`);
      }
    }
  }

  // 3. Visible questions (per-guest, then household)
  const visible = visibleQuestions(ctx.questions, ctx.virtualGuests, ctx.events, ctx.draft);
  for (const { guest, questions } of visible.perGuest) {
    for (const q of questions) {
      keys.push(`answer.${q.id}.${guest.id}`);
    }
  }
  for (const q of visible.household) {
    keys.push(`answer.${q.id}.household`);
  }

  // 4. Note
  keys.push("note");
  return keys;
}

export function firstErrorKey(
  errors: Record<string, string>,
  orderedKeys: string[],
): string | null {
  for (const key of orderedKeys) {
    if (errors[key]) return key;
  }
  const fallback = Object.keys(errors)[0];
  return fallback ?? null;
}
