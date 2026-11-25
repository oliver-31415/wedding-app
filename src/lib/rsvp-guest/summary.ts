/**
 * Pure summary & confirmation email builders for guest RSVPs.
 */
import { formatDateLong, formatTimeRange } from "@/lib/dates";
import {
  answerKey,
  answerLabel,
  guestEventStatus,
  guestName,
  householdIsAttending,
  householdLabel,
  responsesMap,
  rsvpEventsForHousehold,
  visibleQuestions,
  type Draft,
  type SnapAnswer,
  type SnapGuest,
  type SnapHousehold,
  type SnapQuestion,
  type SnapResponse,
} from "@/lib/rsvp/model";
import type { EventDetail } from "./form-model";

export type SummaryEvent = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  attending: { id: string; name: string; ageGroup: "adult" | "child"; isPlusOne: boolean }[];
  declined: { id: string; name: string; ageGroup: "adult" | "child"; isPlusOne: boolean }[];
  pending: { id: string; name: string; ageGroup: "adult" | "child"; isPlusOne: boolean }[];
};

export type SummaryAnswer = {
  questionId: string;
  label: string;
  displayValue: string;
};

export type SummaryGuestAnswers = {
  guestId: string;
  guestName: string;
  ageGroup: "adult" | "child";
  isPlusOne: boolean;
  answers: SummaryAnswer[];
};

export type ConfirmationSummary = {
  householdLabel: string;
  anyAttending: boolean;
  events: SummaryEvent[];
  plusOnes: { id: string; name: string }[];
  guestAnswers: SummaryGuestAnswers[];
  householdAnswers: SummaryAnswer[];
  note: string | null;
};

function resolveDisplayValue(question: SnapQuestion, rawValue: string): string {
  return answerLabel(question, rawValue);
}

export function buildConfirmationSummary(args: {
  household: SnapHousehold;
  guests: SnapGuest[];
  events: EventDetail[];
  questions: SnapQuestion[];
  responses: SnapResponse[];
  answers: SnapAnswer[];
  note: string | null;
}): ConfirmationSummary {
  const { household, guests, events, questions, responses, answers, note } = args;
  const respMap = responsesMap(responses);
  const ansMap = new Map(answers.map((a) => [answerKey(a.questionId, a.guestId), a.value]));
  const draft: Draft = { attendance: respMap, answers: ansMap };

  const rsvpEvents = rsvpEventsForHousehold(guests, events);
  const eventById = new Map(events.map((e) => [e.id, e]));

  const summaryEvents: SummaryEvent[] = rsvpEvents.map((e) => {
    const detail = eventById.get(e.id)!;
    const attending: SummaryEvent["attending"] = [];
    const declined: SummaryEvent["declined"] = [];
    const pending: SummaryEvent["pending"] = [];

    for (const g of guests) {
      const status = guestEventStatus(g, e, guests, respMap);
      const entry = { id: g.id, name: guestName(g), ageGroup: g.ageGroup, isPlusOne: g.isPlusOne };
      if (status === "attending") attending.push(entry);
      else if (status === "declined") declined.push(entry);
      else if (status === "pending") pending.push(entry);
    }

    return {
      id: detail.id,
      name: detail.name,
      startsAt: detail.startsAt,
      endsAt: detail.endsAt,
      venueName: detail.venueName,
      attending,
      declined,
      pending,
    };
  });

  const plusOnes = guests
    .filter((g) => g.isPlusOne)
    .map((g) => ({ id: g.id, name: guestName(g) }));

  const visible = visibleQuestions(questions, guests, events, draft);

  const guestAnswers: SummaryGuestAnswers[] = visible.perGuest
    .map(({ guest, questions: qs }) => {
      const items: SummaryAnswer[] = [];
      for (const q of qs) {
        const raw = ansMap.get(answerKey(q.id, guest.id));
        if (raw === undefined || raw.trim() === "") continue;
        items.push({
          questionId: q.id,
          label: q.label,
          displayValue: resolveDisplayValue(q, raw),
        });
      }
      return {
        guestId: guest.id,
        guestName: guestName(guest),
        ageGroup: guest.ageGroup,
        isPlusOne: guest.isPlusOne,
        answers: items,
      };
    })
    .filter((g) => g.answers.length > 0);

  const householdAnswers: SummaryAnswer[] = [];
  for (const q of visible.household) {
    const raw = ansMap.get(answerKey(q.id, null));
    if (raw === undefined || raw.trim() === "") continue;
    householdAnswers.push({
      questionId: q.id,
      label: q.label,
      displayValue: resolveDisplayValue(q, raw),
    });
  }

  return {
    householdLabel: householdLabel(household, guests),
    anyAttending: householdIsAttending(guests, events, respMap),
    events: summaryEvents,
    plusOnes,
    guestAnswers,
    householdAnswers,
    note: note?.trim() || null,
  };
}

export function formatConfirmationEmailBody(
  summary: ConfirmationSummary,
  wedding: { partnerOne: string; partnerTwo: string },
): string {
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const paragraphs: string[] = [];

  paragraphs.push(`Hi ${summary.householdLabel},`);
  paragraphs.push(
    summary.anyAttending
      ? `Thank you for your RSVP to ${couple}'s wedding. Here is a summary of your response.`
      : `Thank you for letting us know. We're sorry you won't be able to make it to ${couple}'s wedding — here is a summary of your response.`,
  );

  for (const ev of summary.events) {
    const lines: string[] = [];
    const whenParts: string[] = [];
    if (ev.startsAt) {
      whenParts.push(formatDateLong(ev.startsAt));
      whenParts.push(formatTimeRange(ev.startsAt, ev.endsAt));
    }
    const header = whenParts.length > 0 ? `${ev.name} (${whenParts.join(", ")})` : ev.name;
    lines.push(header);
    if (ev.attending.length > 0) {
      lines.push(`Attending: ${ev.attending.map((g) => g.name).join(", ")}`);
    }
    if (ev.declined.length > 0) {
      lines.push(`Can't make it: ${ev.declined.map((g) => g.name).join(", ")}`);
    }
    if (ev.pending.length > 0) {
      lines.push(`Awaiting reply: ${ev.pending.map((g) => g.name).join(", ")}`);
    }
    paragraphs.push(lines.join("\n"));
  }

  if (summary.plusOnes.length > 0) {
    paragraphs.push(`Additional guests: ${summary.plusOnes.map((p) => p.name).join(", ")}`);
  }

  if (summary.guestAnswers.length > 0) {
    const lines: string[] = [];
    for (const ga of summary.guestAnswers) {
      lines.push(ga.guestName);
      for (const a of ga.answers) {
        lines.push(`• ${a.label}: ${a.displayValue}`);
      }
    }
    paragraphs.push(lines.join("\n"));
  }

  if (summary.householdAnswers.length > 0) {
    const lines = summary.householdAnswers.map((a) => `${a.label}: ${a.displayValue}`);
    paragraphs.push(lines.join("\n"));
  }

  if (summary.note) {
    paragraphs.push(`Note to the couple:\n${summary.note}`);
  }

  return paragraphs.join("\n\n");
}

export function formatConfirmationEmailFooter(wedding: {
  partnerOne: string;
  partnerTwo: string;
  date: string | null;
  locationName: string | null;
}): string {
  const parts = [`${wedding.partnerOne} & ${wedding.partnerTwo}`];
  if (wedding.date) parts.push(formatDateLong(wedding.date));
  if (wedding.locationName?.trim()) parts.push(wedding.locationName.trim());
  return parts.join(" · ");
}

/** Collect unique, trimmed non-empty guest email addresses for confirmation emails. */
export function collectRecipientEmails(guests: { email: string | null }[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const g of guests) {
    const trimmed = g.email?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(trimmed);
  }
  return emails;
}
