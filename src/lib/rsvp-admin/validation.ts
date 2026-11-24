import type { Audience, QuestionOption, QuestionType } from "@/db/schema";

export const MAX_QUESTION_LABEL = 300;
export const MAX_OPTION_LABEL = 120;
export const MAX_CLOSED_MESSAGE = 2000;

export type ExistingQuestionRef = {
  id: string;
  type: QuestionType;
  label: string;
  options: QuestionOption[];
  scope: "guest" | "household";
  eventId: string | null;
  parentQuestionId: string | null;
  parentOptionId: string | null;
  archived: boolean;
  position: number;
};

export type EventOptionRef = {
  id: string;
  name: string;
  rsvpEnabled: boolean;
};

export type OptionDraft = {
  id: string;
  label: string;
};

export type QuestionInput = {
  label: string | null;
  type: string | null;
  options: OptionDraft[];
  required: boolean;
  scope: string | null;
  eventId: string | null;
  parentQuestionId: string | null;
  parentOptionId: string | null;
  audience: Audience | { error: string };
};

export type ValidatedQuestion = {
  label: string;
  type: QuestionType;
  options: QuestionOption[];
  required: boolean;
  scope: "guest" | "household";
  eventId: string | null;
  parentQuestionId: string | null;
  parentOptionId: string | null;
  audience: Audience;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; errors: Record<string, string> };

/**
 * Returns true if `possibleAncestorId` is `nodeId` itself or appears anywhere
 * up `nodeId`'s `parentQuestionId` chain. Guards against pre-existing cycles.
 */
export function isSelfOrAncestor(
  possibleAncestorId: string,
  nodeId: string,
  byId: Map<string, Pick<ExistingQuestionRef, "id" | "parentQuestionId">>,
): boolean {
  let cursor: string | null = nodeId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === possibleAncestorId) return true;
    if (visited.has(cursor)) return false;
    visited.add(cursor);
    cursor = byId.get(cursor)?.parentQuestionId ?? null;
  }
  return false;
}

/**
 * Would setting `editingId`'s parent to `candidateParentId` create a self-reference or cycle?
 */
export function wouldCreateCycle(
  editingId: string | null,
  candidateParentId: string,
  allQuestions: Pick<ExistingQuestionRef, "id" | "parentQuestionId">[],
): boolean {
  if (!editingId) return false;
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  return isSelfOrAncestor(editingId, candidateParentId, byId);
}

/**
 * Active multiple-choice questions of the same scope that can safely be selected
 * as the parent of `editingId` without creating a self-reference or cycle.
 */
export function eligibleParentQuestions<T extends ExistingQuestionRef>(
  allQuestions: T[],
  opts: { editingId: string | null; scope: "guest" | "household" },
): T[] {
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  return [...allQuestions]
    .filter((q) => {
      if (q.archived) return false;
      if (q.type !== "choice") return false;
      if (q.options.length === 0) return false;
      if (q.scope !== opts.scope) return false;
      if (opts.editingId && isSelfOrAncestor(opts.editingId, q.id, byId)) return false;
      return true;
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * Parses JSON-encoded options submitted by the question form.
 */
export function parseOptionsJson(raw: string | null): OptionDraft[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id.trim() : "",
        label: typeof item.label === "string" ? item.label : "",
      }));
  } catch {
    return [];
  }
}

export function validateQuestionInput(
  input: QuestionInput,
  ctx: {
    editing: ExistingQuestionRef | null;
    allQuestions: ExistingQuestionRef[];
    events: EventOptionRef[];
    validTagIds: Set<string>;
    answeredOptionIds: Set<string>;
    answerCount: number;
    childQuestions: ExistingQuestionRef[];
    generateOptionId: () => string;
  },
): ValidationResult<ValidatedQuestion> {
  const errors: Record<string, string> = {};

  // --- label
  const label = input.label?.trim() ?? "";
  if (!label) {
    errors.label = "Enter the question text.";
  } else if (label.length > MAX_QUESTION_LABEL) {
    errors.label = `Keep the question under ${MAX_QUESTION_LABEL} characters.`;
  }

  // --- type
  const type: QuestionType | null =
    input.type === "choice" || input.type === "text" ? input.type : null;
  if (!type) {
    errors.type = "Choose a question type.";
  } else if (ctx.editing && type !== ctx.editing.type) {
    if (ctx.answerCount > 0) {
      errors.type = "You can't change the question type once guests have answered it.";
    } else if (ctx.childQuestions.length > 0) {
      errors.type = "You can't change the type while follow-up questions depend on it.";
    }
  }

  // --- scope
  const scope: "guest" | "household" | null =
    input.scope === "guest" || input.scope === "household" ? input.scope : null;
  if (!scope) {
    errors.scope = "Choose whether to ask each guest or once per household.";
  } else if (ctx.editing && scope !== ctx.editing.scope) {
    if (ctx.answerCount > 0) {
      errors.scope = "You can't switch between per-guest and per-household once guests have answered.";
    } else if (ctx.childQuestions.length > 0) {
      errors.scope = "You can't change the scope while follow-up questions depend on this question.";
    }
  }

  // --- options
  const existingOptionIds = new Set(ctx.editing?.options.map((o) => o.id) ?? []);
  const existingOptionById = new Map(ctx.editing?.options.map((o) => [o.id, o]) ?? []);
  const referencedByChildOptionIds = new Set(
    ctx.childQuestions
      .map((c) => c.parentOptionId)
      .filter((id): id is string => Boolean(id)),
  );

  let finalOptions: QuestionOption[] = [];
  if (type === "choice") {
    const cleaned: QuestionOption[] = [];
    const seenLabels = new Set<string>();
    const seenIds = new Set<string>();
    let hasBlankOption = false;
    let hasDuplicateLabel = false;
    let hasTooLongOption = false;

    for (const draft of input.options) {
      const optLabel = draft.label.trim();
      if (!optLabel) {
        hasBlankOption = true;
        continue;
      }
      if (optLabel.length > MAX_OPTION_LABEL) {
        hasTooLongOption = true;
      }
      const norm = optLabel.toLowerCase();
      if (seenLabels.has(norm)) {
        hasDuplicateLabel = true;
      }
      seenLabels.add(norm);

      // Preserve existing option IDs when renaming; assign newId() to new options.
      let id: string;
      if (draft.id && existingOptionIds.has(draft.id) && !seenIds.has(draft.id)) {
        id = draft.id;
      } else {
        id = ctx.generateOptionId();
      }
      seenIds.add(id);
      cleaned.push({ id, label: optLabel });
    }

    const submittedIds = new Set(cleaned.map((o) => o.id));
    const removedAnswered = [...ctx.answeredOptionIds].filter((id) => !submittedIds.has(id));
    const removedReferenced = [...referencedByChildOptionIds].filter(
      (id) => !submittedIds.has(id) && !ctx.answeredOptionIds.has(id),
    );

    if (removedAnswered.length > 0) {
      const names = removedAnswered
        .map((id) => existingOptionById.get(id)?.label)
        .filter(Boolean)
        .map((n) => `“${n}”`);
      errors.options = names.length
        ? `Can't remove ${names.join(", ")} because guests have already chosen ${names.length === 1 ? "it" : "them"}. You can rename ${names.length === 1 ? "it" : "them"} instead.`
        : "Can't remove an option that already has answers. You can rename it instead.";
    } else if (removedReferenced.length > 0) {
      const names = removedReferenced
        .map((id) => existingOptionById.get(id)?.label)
        .filter(Boolean)
        .map((n) => `“${n}”`);
      errors.options = names.length
        ? `Can't remove ${names.join(", ")} because a follow-up question depends on ${names.length === 1 ? "it" : "them"}.`
        : "Can't remove an option that a follow-up question depends on.";
    } else if (hasBlankOption) {
      errors.options = "Fill in every option or remove empty rows.";
    } else if (cleaned.length < 2) {
      errors.options = "Add at least 2 options for a multiple-choice question.";
    } else if (hasTooLongOption) {
      errors.options = `Keep each option under ${MAX_OPTION_LABEL} characters.`;
    } else if (hasDuplicateLabel) {
      errors.options = "Each option needs a different label.";
    }

    finalOptions = cleaned;
  }

  // --- event
  let eventId: string | null = input.eventId?.trim() || null;
  if (eventId) {
    const ev = ctx.events.find((e) => e.id === eventId);
    const wasAlreadyLinked = ctx.editing?.eventId === eventId;
    if (!ev || (!ev.rsvpEnabled && !wasAlreadyLinked)) {
      errors.eventId = "Choose an event that collects RSVPs.";
      eventId = null;
    }
  }

  // --- follow-up parent
  const parentQuestionId: string | null = input.parentQuestionId?.trim() || null;
  let parentOptionId: string | null = input.parentOptionId?.trim() || null;
  if (!parentQuestionId) {
    parentOptionId = null;
  } else {
    const parent = ctx.allQuestions.find((q) => q.id === parentQuestionId);
    if (!parent || parent.archived) {
      errors.parentQuestionId = "Choose an active multiple-choice question.";
    } else if (parent.type !== "choice") {
      errors.parentQuestionId = "Follow-up questions can only depend on a multiple-choice question.";
    } else if (scope && parent.scope !== scope) {
      errors.parentQuestionId =
        "The follow-up question must have the same scope (per guest or per household) as its parent.";
    } else if (wouldCreateCycle(ctx.editing?.id ?? null, parent.id, ctx.allQuestions)) {
      errors.parentQuestionId =
        "A question can't be a follow-up to itself or one of its own follow-ups.";
    } else if (!parentOptionId || !parent.options.some((o) => o.id === parentOptionId)) {
      errors.parentOptionId = "Choose which answer triggers this follow-up question.";
    }
  }

  // --- audience
  let audience: Audience = { mode: "all" };
  if ("error" in input.audience) {
    errors.audience = input.audience.error;
  } else if (input.audience.mode === "tags") {
    const valid = input.audience.tagIds.filter((id) => ctx.validTagIds.has(id));
    if (valid.length === 0) {
      errors.audience = "Choose at least one tag, or pick “Everyone”.";
    } else {
      audience = { mode: "tags", tagIds: valid };
    }
  } else {
    audience = input.audience;
  }

  if (Object.keys(errors).length > 0 || !type || !scope) {
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  return {
    ok: true,
    value: {
      label,
      type,
      options: finalOptions,
      required: input.required,
      scope,
      eventId,
      parentQuestionId,
      parentOptionId,
      audience,
    },
  };
}

export type RsvpSettingsInput = {
  rsvpOpen: boolean;
  rsvpDeadline: string | null;
  rsvpAllowEdits: boolean;
  rsvpClosedMessage: string | null;
};

export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function validateRsvpSettingsInput(
  input: RsvpSettingsInput,
): ValidationResult<RsvpSettingsInput> {
  const errors: Record<string, string> = {};

  const deadline = input.rsvpDeadline?.trim() || null;
  if (deadline && !isValidIsoDate(deadline)) {
    errors.rsvpDeadline = "Enter a valid date (YYYY-MM-DD).";
  }

  const closedMessage = input.rsvpClosedMessage?.trim() || null;
  if (closedMessage && closedMessage.length > MAX_CLOSED_MESSAGE) {
    errors.rsvpClosedMessage = `Keep the closed message under ${MAX_CLOSED_MESSAGE} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  return {
    ok: true,
    value: {
      rsvpOpen: input.rsvpOpen,
      rsvpDeadline: deadline,
      rsvpAllowEdits: input.rsvpAllowEdits,
      rsvpClosedMessage: closedMessage,
    },
  };
}
