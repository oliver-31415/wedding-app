/**
 * The RSVP rules, as pure functions over plain data. Server actions load a
 * `HouseholdSnapshot`/`WeddingSnapshot` from the database and call these; the
 * guest form, the host editor, the stats page and message targeting all use
 * the same functions so they can never disagree.
 */
import type { Audience, QuestionOption, QuestionType } from "@/db/schema";
import { inAudience } from "@/lib/audience";
import { endOfDay } from "@/lib/dates";

export type SnapGuest = {
  id: string;
  householdId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  ageGroup: "adult" | "child";
  isPlusOne: boolean;
  tagIds: string[];
};

export type SnapHousehold = {
  id: string;
  envelopeName: string | null;
  plusOnesAllowed: number;
};

export type SnapEvent = {
  id: string;
  name: string;
  audience: Audience;
  rsvpEnabled: boolean;
  position: number;
};

export type SnapQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  options: QuestionOption[];
  required: boolean;
  scope: "guest" | "household";
  eventId: string | null;
  parentQuestionId: string | null;
  parentOptionId: string | null;
  audience: Audience;
  archived: boolean;
  position: number;
};

export type SnapResponse = { guestId: string; eventId: string; attending: boolean };
export type SnapAnswer = {
  questionId: string;
  guestId: string | null;
  householdId: string | null;
  value: string;
};

export type RsvpSettings = {
  timeZone: string;
  rsvpOpen: boolean;
  rsvpDeadline: string | null;
  rsvpAllowEdits: boolean;
};

// ------------------------------------------------------------ invitations

/**
 * Plus-ones have no tags of their own: they are invited to whatever the
 * household's named guests are invited to (the union of their tags).
 */
export function effectiveTagIds(guest: SnapGuest, householdGuests: SnapGuest[]): string[] {
  if (!guest.isPlusOne) return guest.tagIds;
  const ids = new Set<string>();
  for (const g of householdGuests) if (!g.isPlusOne) g.tagIds.forEach((t) => ids.add(t));
  return [...ids];
}

export function isInvited(guest: SnapGuest, event: SnapEvent, householdGuests: SnapGuest[]): boolean {
  return inAudience(event.audience, effectiveTagIds(guest, householdGuests));
}

/** Events this guest is asked to RSVP to, in schedule order. */
export function rsvpEventsFor(guest: SnapGuest, events: SnapEvent[], householdGuests: SnapGuest[]): SnapEvent[] {
  return sortByPosition(events.filter((e) => e.rsvpEnabled && isInvited(guest, e, householdGuests)));
}

/** Events at least one member of the household is asked to RSVP to. */
export function rsvpEventsForHousehold(householdGuests: SnapGuest[], events: SnapEvent[]): SnapEvent[] {
  return sortByPosition(
    events.filter((e) => e.rsvpEnabled && householdGuests.some((g) => isInvited(g, e, householdGuests))),
  );
}

/** Plus-one spots still free in a household. */
export function plusOnesRemaining(household: SnapHousehold, householdGuests: SnapGuest[]): number {
  return Math.max(0, household.plusOnesAllowed - householdGuests.filter((g) => g.isPlusOne).length);
}

// ------------------------------------------------------------ RSVP window

export type RsvpWindow =
  | { open: true; closesAt: number | null }
  | { open: false; reason: "closed_by_host" | "deadline_passed" };

export function rsvpWindow(settings: RsvpSettings, now = Date.now()): RsvpWindow {
  if (!settings.rsvpOpen) return { open: false, reason: "closed_by_host" };
  if (!settings.rsvpDeadline) return { open: true, closesAt: null };
  const closesAt = endOfDay(settings.rsvpDeadline, settings.timeZone);
  return now <= closesAt ? { open: true, closesAt } : { open: false, reason: "deadline_passed" };
}

// ------------------------------------------------------------ questions

/** Attendance and answers as they stand while a form is being filled in. */
export type Draft = {
  /** key `${guestId}:${eventId}` → attending */
  attendance: Map<string, boolean>;
  /** key `${questionId}:${guestId}` or `${questionId}:household` → value */
  answers: Map<string, string>;
};

export const attendanceKey = (guestId: string, eventId: string) => `${guestId}:${eventId}`;
export const answerKey = (questionId: string, guestId: string | null) =>
  `${questionId}:${guestId ?? "household"}`;

function activeQuestions(questions: SnapQuestion[]): SnapQuestion[] {
  return sortByPosition(questions.filter((q) => !q.archived));
}

/**
 * Is `question` asked of `guest`? (For household-scope questions use
 * `householdQuestionApplies`.) Follow-ups apply only when their parent applies
 * and was answered with the trigger option, so answering "No" to a parent
 * hides — and on save, discards — every follow-up beneath it.
 */
export function guestQuestionApplies(
  question: SnapQuestion,
  guest: SnapGuest,
  ctx: { householdGuests: SnapGuest[]; events: SnapEvent[]; questions: SnapQuestion[]; draft: Draft },
  depth = 0,
): boolean {
  if (question.archived || question.scope !== "guest" || depth > 10) return false;
  if (!inAudience(question.audience, effectiveTagIds(guest, ctx.householdGuests))) return false;
  if (question.eventId) {
    const event = ctx.events.find((e) => e.id === question.eventId);
    if (!event || !event.rsvpEnabled || !isInvited(guest, event, ctx.householdGuests)) return false;
    if (ctx.draft.attendance.get(attendanceKey(guest.id, event.id)) !== true) return false;
  } else if (!comingToSomething(guest, ctx)) {
    return false;
  }
  if (question.parentQuestionId) {
    const parent = ctx.questions.find((q) => q.id === question.parentQuestionId);
    if (!parent || parent.scope !== "guest") return false;
    if (!guestQuestionApplies(parent, guest, ctx, depth + 1)) return false;
    if (ctx.draft.answers.get(answerKey(parent.id, guest.id)) !== question.parentOptionId) return false;
  }
  return true;
}

export function householdQuestionApplies(
  question: SnapQuestion,
  ctx: { householdGuests: SnapGuest[]; events: SnapEvent[]; questions: SnapQuestion[]; draft: Draft },
  depth = 0,
): boolean {
  if (question.archived || question.scope !== "household" || depth > 10) return false;
  const inScope = ctx.householdGuests.filter((g) =>
    inAudience(question.audience, effectiveTagIds(g, ctx.householdGuests)),
  );
  if (inScope.length === 0) return false;
  if (question.eventId) {
    const event = ctx.events.find((e) => e.id === question.eventId);
    if (!event || !event.rsvpEnabled) return false;
    // Asked when anyone in the household is coming to that event.
    const coming = inScope.some(
      (g) => isInvited(g, event, ctx.householdGuests) && ctx.draft.attendance.get(attendanceKey(g.id, event.id)) === true,
    );
    if (!coming) return false;
  } else if (!inScope.some((g) => comingToSomething(g, ctx))) {
    return false;
  }
  if (question.parentQuestionId) {
    const parent = ctx.questions.find((q) => q.id === question.parentQuestionId);
    if (!parent || parent.scope !== "household") return false;
    if (!householdQuestionApplies(parent, ctx, depth + 1)) return false;
    if (ctx.draft.answers.get(answerKey(parent.id, null)) !== question.parentOptionId) return false;
  }
  return true;
}

/**
 * General questions (no event) are for people who are coming: a guest who
 * declines everything isn't asked about dietary needs. If the guest has no
 * RSVP events at all, general questions are still asked.
 */
function comingToSomething(guest: SnapGuest, ctx: { householdGuests: SnapGuest[]; events: SnapEvent[]; draft: Draft }): boolean {
  const mine = rsvpEventsFor(guest, ctx.events, ctx.householdGuests);
  return mine.length === 0 || mine.some((e) => ctx.draft.attendance.get(attendanceKey(guest.id, e.id)) === true);
}

/** Everything the form should show right now, in order. */
export function visibleQuestions(
  questions: SnapQuestion[],
  householdGuests: SnapGuest[],
  events: SnapEvent[],
  draft: Draft,
) {
  const ctx = { householdGuests, events, questions, draft };
  const active = activeQuestions(questions);
  return {
    household: active.filter((q) => householdQuestionApplies(q, ctx)),
    perGuest: householdGuests.map((guest) => ({
      guest,
      questions: active.filter((q) => guestQuestionApplies(q, guest, ctx)),
    })),
  };
}

// ------------------------------------------------------------ submission

export const MAX_TEXT_ANSWER = 1000;
export const MAX_NOTE = 2000;
export const MAX_NAME = 100;
/** Client-side ids for plus-ones that don't exist yet. */
export const NEW_PLUS_ONE_ID = /^new-\d{1,3}$/;

export type PlusOneInput = {
  /** Existing plus-one guest id, or a client temp id like "new-1". */
  id: string;
  firstName: string;
  lastName: string;
};

export type SubmissionInput = {
  attendance: { guestId: string; eventId: string; attending: boolean }[];
  answers: { questionId: string; guestId: string | null; value: string }[];
  /** The full list of plus-ones the household wants; existing ones left out are removed. */
  plusOnes: PlusOneInput[];
  note: string | null;
};

export type ValidatedSubmission = {
  plusOnes: {
    keep: { id: string; firstName: string; lastName: string }[];
    add: { tempId: string; firstName: string; lastName: string }[];
    remove: string[];
  };
  /** The complete set for the household — replaces whatever was stored. */
  attendance: { guestId: string; eventId: string; attending: boolean }[];
  answers: { questionId: string; guestId: string | null; value: string }[];
  note: string | null;
};

export type SubmissionResult =
  | { ok: true; value: ValidatedSubmission }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a household's RSVP and turns it into the exact rows to store.
 *
 * mode "guest": every invited guest must answer every RSVP event and every
 *   required question that applies; the RSVP window must be open.
 * mode "host": the couple can save partial answers at any time.
 *
 * In both modes answers to questions that no longer apply (e.g. a meal choice
 * for someone who has now declined) are dropped, and answers are checked
 * against the question's options.
 */
export function validateSubmission(
  input: SubmissionInput,
  ctx: {
    household: SnapHousehold;
    guests: SnapGuest[];
    events: SnapEvent[];
    questions: SnapQuestion[];
    mode: "guest" | "host";
  },
): SubmissionResult {
  const errors: Record<string, string> = {};
  const { household } = ctx;
  const mainGuests = ctx.guests.filter((g) => !g.isPlusOne);
  const existingPlusOnes = ctx.guests.filter((g) => g.isPlusOne);

  // --- plus-ones
  const keep: ValidatedSubmission["plusOnes"]["keep"] = [];
  const add: ValidatedSubmission["plusOnes"]["add"] = [];
  const seen = new Set<string>();
  input.plusOnes.forEach((p, i) => {
    const firstName = p.firstName.trim();
    const lastName = p.lastName.trim();
    if (seen.has(p.id)) return;
    seen.add(p.id);
    if (!firstName || !lastName) {
      errors[`plusOne.${i}`] = "Enter their first and last name.";
      return;
    }
    if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
      errors[`plusOne.${i}`] = "That name is too long.";
      return;
    }
    if (existingPlusOnes.some((g) => g.id === p.id)) keep.push({ id: p.id, firstName, lastName });
    else if (NEW_PLUS_ONE_ID.test(p.id)) add.push({ tempId: p.id, firstName, lastName });
    else errors[`plusOne.${i}`] = "Something went wrong with this guest — please remove and add them again.";
  });
  if (keep.length + add.length > household.plusOnesAllowed) {
    errors.plusOnes =
      household.plusOnesAllowed === 0
        ? "This invitation doesn't include a plus-one."
        : `You can bring up to ${household.plusOnesAllowed} extra ${household.plusOnesAllowed === 1 ? "guest" : "guests"}.`;
  }
  const remove = existingPlusOnes.filter((g) => !keep.some((k) => k.id === g.id)).map((g) => g.id);

  // The household as it will be after this submission.
  const finalGuests: SnapGuest[] = [
    ...mainGuests,
    ...keep.map((k) => ({ ...existingPlusOnes.find((g) => g.id === k.id)!, ...k })),
    ...add.map((a) => ({
      id: a.tempId,
      householdId: household.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: null,
      ageGroup: "adult" as const,
      isPlusOne: true,
      tagIds: [],
    })),
  ];

  // --- attendance
  const draft: Draft = { attendance: new Map(), answers: new Map() };
  const attendance: ValidatedSubmission["attendance"] = [];
  for (const a of input.attendance) {
    const guest = finalGuests.find((g) => g.id === a.guestId);
    const event = ctx.events.find((e) => e.id === a.eventId);
    if (!guest || !event || !event.rsvpEnabled || !isInvited(guest, event, finalGuests)) continue;
    const key = attendanceKey(guest.id, event.id);
    if (draft.attendance.has(key)) continue;
    draft.attendance.set(key, a.attending);
    attendance.push({ guestId: guest.id, eventId: event.id, attending: a.attending });
  }
  if (ctx.mode === "guest") {
    for (const guest of finalGuests) {
      for (const event of rsvpEventsFor(guest, ctx.events, finalGuests)) {
        const key = attendanceKey(guest.id, event.id);
        if (!draft.attendance.has(key)) {
          errors[`attendance.${guest.id}.${event.id}`] = `Let us know if ${guest.firstName} can make it.`;
        } else if (guest.isPlusOne && draft.attendance.get(key)) {
          // A plus-one comes with the household, not instead of it.
          const hostComing = finalGuests.some(
            (g) => !g.isPlusOne && isInvited(g, event, finalGuests) && draft.attendance.get(attendanceKey(g.id, event.id)),
          );
          if (!hostComing) {
            errors[`attendance.${guest.id}.${event.id}`] = `${guest.firstName} can come along with someone from your invitation.`;
          }
        }
      }
    }
  }

  // --- answers: check shape, then keep only those that apply
  const byQuestion = new Map(ctx.questions.map((q) => [q.id, q]));
  for (const a of input.answers) {
    const q = byQuestion.get(a.questionId);
    if (!q || q.archived) continue;
    const guestId = q.scope === "household" ? null : a.guestId;
    if (q.scope === "guest" && !finalGuests.some((g) => g.id === guestId)) continue;
    const value = a.value.trim();
    if (value === "") continue;
    const field = `answer.${q.id}.${guestId ?? "household"}`;
    if (q.type === "choice" && !q.options.some((o) => o.id === value)) {
      errors[field] = "Choose one of the options.";
      continue;
    }
    if (q.type === "text" && value.length > MAX_TEXT_ANSWER) {
      errors[field] = `Keep this under ${MAX_TEXT_ANSWER} characters.`;
      continue;
    }
    draft.answers.set(answerKey(q.id, guestId), value);
  }

  const visible = visibleQuestions(ctx.questions, finalGuests, ctx.events, draft);
  const answers: ValidatedSubmission["answers"] = [];
  const collect = (q: SnapQuestion, guest: SnapGuest | null) => {
    const value = draft.answers.get(answerKey(q.id, guest?.id ?? null));
    const field = `answer.${q.id}.${guest?.id ?? "household"}`;
    if (value !== undefined) answers.push({ questionId: q.id, guestId: guest?.id ?? null, value });
    else if (ctx.mode === "guest" && q.required && !errors[field]) {
      errors[field] = guest ? `Please answer this for ${guest.firstName}.` : "Please answer this question.";
    }
  };
  visible.household.forEach((q) => collect(q, null));
  visible.perGuest.forEach(({ guest, questions }) => questions.forEach((q) => collect(q, guest)));

  // --- note
  const note = input.note?.trim() || null;
  if (note && note.length > MAX_NOTE) errors.note = `Keep your note under ${MAX_NOTE} characters.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { plusOnes: { keep, add, remove }, attendance, answers, note } };
}

// ------------------------------------------------------------ status

export type GuestEventStatus = "attending" | "declined" | "pending" | "not_invited";

export function guestEventStatus(
  guest: SnapGuest,
  event: SnapEvent,
  householdGuests: SnapGuest[],
  responses: Map<string, boolean>,
): GuestEventStatus {
  if (!event.rsvpEnabled || !isInvited(guest, event, householdGuests)) return "not_invited";
  const r = responses.get(attendanceKey(guest.id, event.id));
  return r === undefined ? "pending" : r ? "attending" : "declined";
}

/**
 * not_started — nobody in the household has answered anything
 * partial     — some (guest, event) pairs still unanswered (e.g. an event added later)
 * complete    — every invited pair answered
 * none        — the household isn't asked to RSVP to anything
 */
export type HouseholdRsvpState = "not_started" | "partial" | "complete" | "none";

export function householdRsvpState(
  householdGuests: SnapGuest[],
  events: SnapEvent[],
  responses: Map<string, boolean>,
): HouseholdRsvpState {
  let invited = 0;
  let answered = 0;
  for (const guest of householdGuests) {
    for (const event of rsvpEventsFor(guest, events, householdGuests)) {
      invited++;
      if (responses.has(attendanceKey(guest.id, event.id))) answered++;
    }
  }
  if (invited === 0) return "none";
  if (answered === 0) return "not_started";
  return answered === invited ? "complete" : "partial";
}

/**
 * Anyone in the household attending an event they're still invited to and
 * that still collects RSVPs (the same rule the stats use).
 */
export function householdIsAttending(
  householdGuests: SnapGuest[],
  events: SnapEvent[],
  responses: Map<string, boolean>,
): boolean {
  return householdGuests.some((g) =>
    events.some((e) => guestEventStatus(g, e, householdGuests, responses) === "attending"),
  );
}

/**
 * Stored answers a form can show and resubmit: drops answers to archived or
 * deleted questions and choices whose option has since been removed, so the
 * guest (or host) simply picks again instead of hitting an invisible error.
 */
export function usableAnswers<T extends { questionId: string; value: string }>(answers: T[], questions: SnapQuestion[]): T[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return answers.filter((a) => {
    const q = byId.get(a.questionId);
    if (!q || q.archived) return false;
    return q.type === "text" || q.options.some((o) => o.id === a.value);
  });
}

export function responsesMap(responses: SnapResponse[]): Map<string, boolean> {
  return new Map(responses.map((r) => [attendanceKey(r.guestId, r.eventId), r.attending]));
}

// ------------------------------------------------------------ helpers

export function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

export function guestName(g: { firstName: string; lastName: string }): string {
  return `${g.firstName} ${g.lastName}`.trim();
}

/** "The Jones Family", or "David, Susan & Nathan Jones" when no envelope name is set. */
export function householdLabel(household: { envelopeName: string | null }, guests: SnapGuest[]): string {
  if (household.envelopeName?.trim()) return household.envelopeName.trim();
  const main = guests.filter((g) => !g.isPlusOne);
  if (main.length === 0) return "Unnamed household";
  const lastNames = new Set(main.map((g) => g.lastName));
  if (lastNames.size === 1) {
    const firsts = main.map((g) => g.firstName);
    const joined = firsts.length === 1 ? firsts[0] : `${firsts.slice(0, -1).join(", ")} & ${firsts.at(-1)}`;
    return `${joined} ${main[0].lastName}`;
  }
  const names = main.map(guestName);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
