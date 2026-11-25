/**
 * Every number the host sees comes from here, so the dashboard, the RSVP page
 * and the guest list always agree. Pure: callers pass a `WeddingSnapshot`
 * (see src/lib/snapshot.ts).
 */
import {
  answerKey,
  effectiveTagIds,
  guestEventStatus,
  guestName,
  guestQuestionApplies,
  householdLabel,
  householdQuestionApplies,
  householdRsvpState,
  responsesMap,
  sortByPosition,
  type Draft,
  type HouseholdRsvpState,
  type SnapAnswer,
  type SnapEvent,
  type SnapGuest,
  type SnapHousehold,
  type SnapQuestion,
  type SnapResponse,
} from "@/lib/rsvp/model";
import { inAudience } from "@/lib/audience";
import type { QuestionType } from "@/db/schema";
import { DIETARY_NEEDS, dietaryGroup, hasNoNeeds, parseDietary, type DietaryAnswer } from "@/lib/rsvp/dietary";

export type WeddingSnapshot = {
  households: SnapHousehold[];
  guests: SnapGuest[];
  events: SnapEvent[];
  questions: SnapQuestion[];
  responses: SnapResponse[];
  answers: SnapAnswer[];
};

export type Count = { n: number; of: number };
export const pct = ({ n, of }: Count) => (of === 0 ? 0 : Math.round((n / of) * 100));

export type EventStats = {
  eventId: string;
  name: string;
  /** Guests asked to RSVP (named guests only — open plus-one spots are separate). */
  invited: number;
  attending: number;
  attendingAdults: number;
  attendingChildren: number;
  declined: number;
  pending: number;
  /** Unnamed plus-one spots in households still deciding about this event (could still come). */
  openPlusOnes: number;
};

export type QuestionStats = {
  questionId: string;
  label: string;
  type: QuestionType;
  scope: "guest" | "household";
  eventId: string | null;
  /** How many guests (or households) this question currently applies to. */
  asked: number;
  answered: number;
  options: { id: string; label: string; count: number }[];
  /** Answers naming an option the couple has since removed (choice questions). */
  removedOptionAnswers: number;
  textAnswers: { who: string; value: string }[];
  /** Dietary questions only: everyone asked, and the totals built from them. */
  dietary: DietaryStats | null;
};

export type DietaryStats = {
  /** Everyone the question applies to, answered (`answer`) or not yet (null). */
  people: { guestId: string; householdId: string; who: string; answer: DietaryAnswer | null }[];
  /** One slice per exact combination of needs, so slices never overlap. Largest first; "No requirements" last. */
  groups: { key: string; label: string; count: number }[];
  /** How many people need each item (someone vegan and gluten free counts in both). */
  needs: { id: string; label: string; count: number }[];
  /** Answered with at least one need or a note. */
  withNeeds: number;
};

export type WeddingStats = {
  guests: {
    total: number;
    adults: number;
    children: number;
    plusOnes: number;
    /** Adults (not plus-ones) with no email address. */
    withoutEmail: number;
    /** Households where nobody has an email address — they can't be emailed at all. */
    householdsWithoutEmail: number;
  };
  households: { total: number } & Record<HouseholdRsvpState, number>;
  /** Households that have fully answered, out of households asked to RSVP. */
  responseRate: Count;
  /** Distinct guests attending at least one event. */
  attendingAnything: number;
  /** allowed = total granted; named = plus-ones guests have added; open = unnamed spots in households that haven't finished replying. */
  plusOneSpots: { allowed: number; named: number; open: number };
  events: EventStats[];
  questions: QuestionStats[];
};

export function computeStats(s: WeddingSnapshot): WeddingStats {
  const responses = responsesMap(s.responses);
  const byHousehold = groupBy(s.guests, (g) => g.householdId);
  const membersOf = (householdId: string) => byHousehold.get(householdId) ?? [];

  // households
  const households = { total: s.households.length, not_started: 0, partial: 0, complete: 0, none: 0 };
  for (const h of s.households) households[householdRsvpState(membersOf(h.id), s.events, responses)]++;
  const asked = households.total - households.none;

  // guests
  const attendingIds = new Set<string>();
  const guests = {
    total: s.guests.length,
    adults: s.guests.filter((g) => g.ageGroup === "adult").length,
    children: s.guests.filter((g) => g.ageGroup === "child").length,
    plusOnes: s.guests.filter((g) => g.isPlusOne).length,
    withoutEmail: s.guests.filter((g) => !g.isPlusOne && g.ageGroup === "adult" && !g.email).length,
    householdsWithoutEmail: s.households.filter((h) => !membersOf(h.id).some((g) => g.email)).length,
  };
  const plusOneSpots = {
    allowed: s.households.reduce((sum, h) => sum + h.plusOnesAllowed, 0),
    named: guests.plusOnes,
    open: s.households.reduce((sum, h) => {
      const members = membersOf(h.id);
      const state = householdRsvpState(members, s.events, responses);
      if (state === "complete" || state === "none") return sum;
      return sum + Math.max(0, h.plusOnesAllowed - members.filter((g) => g.isPlusOne).length);
    }, 0),
  };

  // events
  const events: EventStats[] = sortByPosition(s.events.filter((e) => e.rsvpEnabled)).map((event) => {
    const row: EventStats = {
      eventId: event.id,
      name: event.name,
      invited: 0,
      attending: 0,
      attendingAdults: 0,
      attendingChildren: 0,
      declined: 0,
      pending: 0,
      openPlusOnes: 0,
    };
    for (const h of s.households) {
      const members = membersOf(h.id);
      let householdPending = false;
      for (const g of members) {
        const status = guestEventStatus(g, event, members, responses);
        if (status === "not_invited") continue;
        row.invited++;
        if (status === "attending") {
          attendingIds.add(g.id);
          row.attending++;
          if (g.ageGroup === "child") row.attendingChildren++;
          else row.attendingAdults++;
        } else if (status === "declined") row.declined++;
        else {
          row.pending++;
          if (!g.isPlusOne) householdPending = true;
        }
      }
      // Spots only count while the household is still deciding about this event.
      if (householdPending) {
        row.openPlusOnes += Math.max(0, h.plusOnesAllowed - members.filter((g) => g.isPlusOne).length);
      }
    }
    return row;
  });

  // questions — evaluated against stored answers exactly as the form would
  const answerMap = new Map(s.answers.map((a) => [answerKey(a.questionId, a.guestId), a.value]));
  const householdAnswerMap = new Map(
    s.answers.filter((a) => a.householdId).map((a) => [`${a.questionId}:${a.householdId}`, a.value]),
  );
  const questions: QuestionStats[] = sortByPosition(s.questions.filter((q) => !q.archived)).map((q) => {
    const row: QuestionStats = {
      questionId: q.id,
      label: q.label,
      type: q.type,
      scope: q.scope,
      eventId: q.eventId,
      asked: 0,
      answered: 0,
      options: q.options.map((o) => ({ id: o.id, label: o.label, count: 0 })),
      removedOptionAnswers: 0,
      textAnswers: [],
      dietary: q.type === "dietary" ? { people: [], groups: [], needs: [], withNeeds: 0 } : null,
    };
    const record = (value: string | undefined, who: string, guest?: SnapGuest) => {
      if (row.dietary && guest) {
        const answer = value === undefined ? null : parseDietary(value);
        row.dietary.people.push({ guestId: guest.id, householdId: guest.householdId, who, answer });
        if (answer) row.answered++;
        return;
      }
      if (value === undefined) return;
      row.answered++;
      if (q.type === "choice") {
        const opt = row.options.find((o) => o.id === value);
        if (opt) opt.count++;
        else row.removedOptionAnswers++;
      } else row.textAnswers.push({ who, value });
    };
    for (const h of s.households) {
      const members = membersOf(h.id);
      const draft: Draft = { attendance: responses, answers: new Map() };
      // Rebuild this household's answers keyed the way the rules expect.
      for (const g of members) for (const other of s.questions) {
        const v = answerMap.get(answerKey(other.id, g.id));
        if (v !== undefined) draft.answers.set(answerKey(other.id, g.id), v);
      }
      for (const other of s.questions) {
        const v = householdAnswerMap.get(`${other.id}:${h.id}`);
        if (v !== undefined) draft.answers.set(answerKey(other.id, null), v);
      }
      const ctx = { householdGuests: members, events: s.events, questions: s.questions, draft };
      if (q.scope === "household") {
        if (!householdQuestionApplies(q, ctx)) continue;
        row.asked++;
        record(draft.answers.get(answerKey(q.id, null)), householdLabel(h, members));
      } else {
        for (const g of members) {
          if (!guestQuestionApplies(q, g, ctx)) continue;
          row.asked++;
          record(draft.answers.get(answerKey(q.id, g.id)), guestName(g), g);
        }
      }
    }
    if (row.dietary) summariseDietary(row.dietary);
    return row;
  });

  return {
    guests,
    households,
    responseRate: { n: households.complete, of: asked },
    attendingAnything: attendingIds.size,
    plusOneSpots,
    events,
    questions,
  };
}

function summariseDietary(d: DietaryStats) {
  const groups = new Map<string, { key: string; label: string; count: number }>();
  const needs = new Map<string, number>();
  for (const p of d.people) {
    if (!p.answer) continue;
    if (!hasNoNeeds(p.answer)) d.withNeeds++;
    const g = dietaryGroup(p.answer);
    const entry = groups.get(g.key) ?? { ...g, count: 0 };
    entry.count++;
    groups.set(g.key, entry);
    for (const n of p.answer.needs) needs.set(n, (needs.get(n) ?? 0) + 1);
  }
  d.groups = [...groups.values()].sort(
    (a, b) => Number(a.key === "none") - Number(b.key === "none") || b.count - a.count || a.label.localeCompare(b.label),
  );
  d.needs = DIETARY_NEEDS.map((n) => ({ id: n.id, label: n.label, count: needs.get(n.id) ?? 0 })).filter((n) => n.count > 0);
}

/** Guests in an audience (for "this page is visible to N guests" hints). */
export function countInAudience(s: Pick<WeddingSnapshot, "guests">, audience: SnapEvent["audience"]): number {
  const byHousehold = groupBy(s.guests, (g) => g.householdId);
  return s.guests.filter((g) => inAudience(audience, effectiveTagIds(g, byHousehold.get(g.householdId) ?? [])))
    .length;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}
