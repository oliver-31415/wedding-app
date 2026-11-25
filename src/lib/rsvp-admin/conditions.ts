import type { Audience, QuestionOption, QuestionType } from "@/db/schema";

export type ConditionEventRef = {
  id: string;
  name: string;
  rsvpEnabled?: boolean;
};

export type ConditionQuestionRef = {
  id: string;
  label: string;
  options: QuestionOption[];
  archived?: boolean;
};

export type ConditionSubject = {
  scope: "guest" | "household";
  eventId: string | null;
  parentQuestionId: string | null;
  parentOptionId: string | null;
  audience: Audience;
};

export type ConditionLookups = {
  eventsById: Map<string, ConditionEventRef>;
  questionsById: Map<string, ConditionQuestionRef>;
  tagsById: Map<string, string>;
};

/**
 * Turns a question's eligibility rules into plain-English clauses for the couple.
 * Matches the rules in `guestQuestionApplies` / `householdQuestionApplies`.
 */
export function describeQuestionConditions(
  question: ConditionSubject,
  lookups: ConditionLookups,
): string[] {
  const clauses: string[] = [];

  if (question.eventId) {
    const event = lookups.eventsById.get(question.eventId);
    if (event) {
      const base =
        question.scope === "household"
          ? `Asked of households attending ${event.name}`
          : `Asked of guests attending ${event.name}`;
      clauses.push(
        event.rsvpEnabled === false ? `${base} (RSVPs turned off for this event)` : base,
      );
    } else {
      clauses.push("Linked event was removed");
    }
  }

  if (question.parentQuestionId) {
    const parent = lookups.questionsById.get(question.parentQuestionId);
    if (!parent) {
      clauses.push("Parent question was removed (won't be asked)");
    } else {
      const option = parent.options.find((o) => o.id === question.parentOptionId);
      const base = option
        ? `Only if they answered '${option.label}' to '${parent.label}'`
        : `Only if they answered a removed option on '${parent.label}'`;
      clauses.push(parent.archived ? `${base} (parent archived — won't be asked)` : base);
    }
  }

  if (question.audience.mode === "tags") {
    const names = question.audience.tagIds
      .map((id) => lookups.tagsById.get(id))
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) {
      clauses.push(`Only guests tagged ${names.join(", ")}`);
    } else {
      clauses.push("No guests (selected tags were removed)");
    }
  }

  // Questions not tied to an event go to people coming to something (see
  // comingToSomething in src/lib/rsvp/model.ts); follow-ups inherit their parent's rule.
  if (!question.eventId && !question.parentQuestionId) {
    clauses.unshift(
      question.scope === "household"
        ? "Asked of households coming to at least one event"
        : "Asked of guests coming to at least one event",
    );
  }

  return clauses;
}

export function formatQuestionConditions(
  question: ConditionSubject,
  lookups: ConditionLookups,
): string {
  return describeQuestionConditions(question, lookups).join(" · ");
}

/**
 * Builds the confirmation message for deleting or archiving a question,
 * explicitly warning if active follow-up questions depend on it.
 */
export function describeQuestionRemovalConfirm(
  questionLabel: string,
  activeFollowUpLabels: string[],
  mode: "delete" | "archive",
): string {
  const followUpWarning = formatFollowUpWarning(activeFollowUpLabels);
  if (mode === "delete") {
    return followUpWarning
      ? `Delete “${questionLabel}”? ${followUpWarning}`
      : `Delete “${questionLabel}”? This can't be undone.`;
  }
  return followUpWarning
    ? `Archive “${questionLabel}”? Existing answers will be kept, but this question won't be asked any more. ${followUpWarning}`
    : `Archive “${questionLabel}”? Existing answers will be kept, and you can restore it later.`;
}

export function formatFollowUpWarning(activeFollowUpLabels: string[]): string | null {
  if (activeFollowUpLabels.length === 0) return null;
  if (activeFollowUpLabels.length === 1) {
    return `Its follow-up question (“${activeFollowUpLabels[0]}”) won't be asked any more.`;
  }
  const listed = activeFollowUpLabels.map((l) => `“${l}”`).join(", ");
  return `Its ${activeFollowUpLabels.length} follow-up questions (${listed}) won't be asked any more.`;
}

/**
 * A question's settings as one short sentence for the questions list, e.g.
 * "Each guest coming to Reception · tagged Family · must answer". The
 * follow-up condition is left out: the list shows it by nesting the question
 * under the answer that triggers it.
 */
export function summariseQuestion(
  question: ConditionSubject & { type: QuestionType; required: boolean },
  lookups: ConditionLookups,
): string {
  const who = question.scope === "household" ? "Once per household" : "Each guest";
  const parts: string[] = [];
  if (question.eventId) {
    const event = lookups.eventsById.get(question.eventId);
    parts.push(
      event
        ? `${who} coming to ${event.name}${event.rsvpEnabled === false ? " (RSVPs off for it)" : ""}`
        : `${who} · its event was removed`,
    );
  } else {
    parts.push(question.parentQuestionId ? who : `${who} coming to anything`);
  }
  if (question.audience.mode === "tags") {
    const names = question.audience.tagIds.map((id) => lookups.tagsById.get(id)).filter(Boolean);
    parts.push(names.length ? `tagged ${names.join(" or ")}` : "nobody (its tags were removed)");
  }
  parts.push(question.type === "choice" ? "pick one" : question.type === "dietary" ? "tick what applies" : "typed answer");
  if (question.required) parts.push("must answer");
  return parts.join(" · ");
}
