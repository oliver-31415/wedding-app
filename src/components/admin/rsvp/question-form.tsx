"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  AudiencePicker,
  Button,
  Checkbox,
  Field,
  FormMessage,
  Input,
  LinkButton,
  Notice,
  SubmitButton,
} from "@/components/ui";
import type { Audience, QuestionOption, QuestionType } from "@/db/schema";
import type { ActionState } from "@/lib/forms";
import { DIETARY_NEEDS } from "@/lib/rsvp/dietary";
import { eligibleParentQuestions, type ExistingQuestionRef } from "@/lib/rsvp-admin/validation";

const TYPE_TITLES: Record<QuestionType, string> = {
  choice: "Pick one option",
  text: "Type an answer",
  dietary: "Dietary requirements",
};

/** A select that sits inside a sentence ("Ask [each guest] coming to [Reception]"). */
const inlineSelect =
  "h-8 rounded-md border border-control bg-surface px-2 text-sm font-medium text-ink focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 aria-[invalid=true]:border-bad";

type OptionRow = {
  key: string;
  id: string;
  label: string;
};

export type QuestionFormInitial = {
  id?: string;
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

function toOptionRows(options: QuestionOption[]): OptionRow[] {
  if (options.length >= 2) {
    return options.map((o) => ({ key: o.id, id: o.id, label: o.label }));
  }
  const rows: OptionRow[] = options.map((o) => ({ key: o.id, id: o.id, label: o.label }));
  while (rows.length < 2) {
    rows.push({ key: `blank-${rows.length}`, id: "", label: "" });
  }
  return rows;
}

export function QuestionForm({
  action,
  initial,
  allQuestions,
  events,
  tags,
  answeredOptionIds,
  referencedOptionIds,
  answerCount,
  childCount,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: QuestionFormInitial;
  allQuestions: ExistingQuestionRef[];
  events: { id: string; name: string; rsvpEnabled: boolean }[];
  tags: { id: string; name: string }[];
  answeredOptionIds: string[];
  referencedOptionIds: string[];
  answerCount: number;
  childCount: number;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);

  const [label, setLabel] = useState(initial.label);
  const [type, setType] = useState<QuestionType>(initial.type);
  const [options, setOptions] = useState<OptionRow[]>(() => toOptionRows(initial.options));
  const [required, setRequired] = useState(initial.required);
  const [scope, setScope] = useState<"guest" | "household">(initial.scope);
  const [eventId, setEventId] = useState(initial.eventId ?? "");
  const [parentQuestionId, setParentQuestionId] = useState(initial.parentQuestionId ?? "");
  const [parentOptionId, setParentOptionId] = useState(initial.parentOptionId ?? "");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const showFollowUp = followUpOpen || !!parentQuestionId;

  const nextKey = useRef(0);
  const initialOptionsSig = useMemo(() => JSON.stringify(initial.options), [initial.options]);
  const [syncedOptionsSig, setSyncedOptionsSig] = useState(initialOptionsSig);

  // Sync server-assigned option IDs back after a successful edit save.
  if (syncedOptionsSig !== initialOptionsSig) {
    setSyncedOptionsSig(initialOptionsSig);
    if (initial.id && initial.type === "choice" && initial.options.length > 0) {
      setOptions(toOptionRows(initial.options));
    }
  }

  const answeredSet = useMemo(() => new Set(answeredOptionIds), [answeredOptionIds]);
  const referencedSet = useMemo(() => new Set(referencedOptionIds), [referencedOptionIds]);

  const isEditing = Boolean(initial.id);
  const typeLocked = isEditing && (answerCount > 0 || childCount > 0);
  // Dietary requirements are always per guest, so each person is counted.
  const scopeLocked = (isEditing && (answerCount > 0 || childCount > 0)) || type === "dietary";
  const otherDietary = allQuestions.some((q) => q.type === "dietary" && !q.archived && q.id !== initial.id);
  const lockReason =
    type === "dietary" && !(isEditing && (answerCount > 0 || childCount > 0))
      ? "dietary requirements are asked of each guest"
      : answerCount > 0
      ? `this question already has ${answerCount} ${answerCount === 1 ? "answer" : "answers"}`
      : "follow-up questions depend on it";

  const scopedParents = useMemo(
    () =>
      eligibleParentQuestions(allQuestions, {
        editingId: initial.id ?? null,
        scope,
      }),
    [allQuestions, initial.id, scope],
  );

  const selectedParent = scopedParents.find((p) => p.id === parentQuestionId) ?? null;

  const selectableEvents = useMemo(
    () => events.filter((e) => e.rsvpEnabled || e.id === initial.eventId),
    [events, initial.eventId],
  );

  function handleScopeChange(nextScope: "guest" | "household") {
    setScope(nextScope);
    if (parentQuestionId) {
      const parentStillValid = eligibleParentQuestions(allQuestions, {
        editingId: initial.id ?? null,
        scope: nextScope,
      }).some((p) => p.id === parentQuestionId);
      if (!parentStillValid) {
        setParentQuestionId("");
        setParentOptionId("");
      }
    }
  }

  function addOption() {
    nextKey.current += 1;
    setOptions((prev) => [...prev, { key: `new-${nextKey.current}`, id: "", label: "" }]);
  }

  function updateOption(key: string, nextLabel: string) {
    setOptions((prev) =>
      prev.map((row) => (row.key === key ? { ...row, label: nextLabel } : row)),
    );
  }

  function removeOption(key: string) {
    setOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((row) => row.key !== key);
    });
  }

  const optionsJson = JSON.stringify(options.map(({ id, label: optLabel }) => ({ id, label: optLabel })));

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="optionsJson" value={optionsJson} />

      <FormMessage state={state} />

      <Field
        label="Question"
        htmlFor="label"
        error={state?.errors?.label}
      >
        <Input
          id="label"
          name="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Main course, Any dietary requirements?"
          invalid={!!state?.errors?.label}
          required
        />
      </Field>

      <Field
        label="How guests answer"
        htmlFor="type-choice"
        error={state?.errors?.type}
        hint={
          typeLocked
            ? `Can't be changed because ${lockReason}.`
            : undefined
        }
      >
        {typeLocked ? (
          <>
            <input type="hidden" name="type" value={type} />
            <p className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-ink">
              {TYPE_TITLES[type]}
            </p>
          </>
        ) : (
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {(
              [
                ["choice", TYPE_TITLES.choice, "e.g. meal choice, yes / no"],
                ["text", TYPE_TITLES.text, "e.g. a song request"],
                ["dietary", TYPE_TITLES.dietary, "tick what applies, tracked per person"],
              ] as const
            )
              .filter(([value]) => value !== "dietary" || !otherDietary || type === "dietary")
              .map(([value, title, example]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-control px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input
                  id={`type-${value}`}
                  type="radio"
                  name="type"
                  value={value}
                  checked={type === value}
                  onChange={() => {
                    setType(value);
                    if (value === "dietary") handleScopeChange("guest");
                  }}
                  className="size-4 accent-brand"
                />
                <span>
                  <span className="font-medium text-ink">{title}</span>
                  <span className="text-ink-muted"> · {example}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </Field>

      {type === "choice" && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Options</span>
            <span className="text-xs text-ink-muted">At least 2 options</span>
          </div>

          <div className="space-y-2">
            {options.map((opt, idx) => {
              const hasAnswers = Boolean(opt.id && answeredSet.has(opt.id));
              const hasFollowUps = Boolean(opt.id && referencedSet.has(opt.id));
              const blocked = hasAnswers || hasFollowUps;
              const disableRemove = blocked || options.length <= 2;

              return (
                <div key={opt.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Option ${idx + 1}`}
                      value={opt.label}
                      onChange={(e) => updateOption(opt.key, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      invalid={!!state?.errors?.options && !opt.label.trim()}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disableRemove}
                      onClick={() => removeOption(opt.key)}
                      title={
                        hasAnswers
                          ? "Can't remove because guests have already chosen this option"
                          : hasFollowUps
                            ? "Can't remove because a follow-up question depends on this option"
                            : options.length <= 2
                              ? "Multiple-choice questions need at least 2 options"
                              : `Remove option ${idx + 1}`
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={addOption}>
              Add option
            </Button>
            {options.some((o) => o.id && (answeredSet.has(o.id) || referencedSet.has(o.id))) && (
              <p className="text-xs text-ink-muted">
                Options guests have chosen, or that a follow-up depends on, can be renamed but not removed.
              </p>
            )}
          </div>

          {state?.errors?.options && (
            <p className="text-sm text-bad">{state.errors.options}</p>
          )}
        </div>
      )}

      {type === "dietary" && (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-medium text-ink">Guests tick whatever applies to them</p>
          <p className="text-ink-muted">
            {DIETARY_NEEDS.map((n) => n.label).join(" · ")} · or “No dietary requirements”. There&apos;s a box for
            anything else, like how serious an allergy is.
          </p>
          <p className="text-ink-muted">
            Answers are counted on <span className="font-medium text-ink">RSVPs → Dietary</span>, with a chart and a
            list of who needs what.
          </p>
        </div>
      )}

      <fieldset className="space-y-4 rounded-xl border border-line bg-sunken/40 p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Who&apos;s asked</legend>

        {/* One sentence of choices: who answers, and when. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink">
          <span>Ask</span>
          {scopeLocked ? (
            <>
              <input type="hidden" name="scope" value={scope} />
              <span className="rounded-md bg-surface px-2 py-1 font-medium" title={`Can't be changed because ${lockReason}.`}>
                {scope === "household" ? "once per household" : "each guest"}
              </span>
            </>
          ) : (
            <select
              aria-label="Who answers"
              name="scope"
              value={scope}
              onChange={(e) => handleScopeChange(e.target.value as "guest" | "household")}
              className={inlineSelect}
            >
              <option value="guest">each guest</option>
              <option value="household">once per household</option>
            </select>
          )}
          <span>coming to</span>
          <select
            aria-label="Which event"
            id="eventId"
            name="eventId"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            aria-invalid={!!state?.errors?.eventId || undefined}
            className={inlineSelect}
          >
            <option value="">{parentQuestionId ? "whatever the first question was for" : "any event"}</option>
            {selectableEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {!ev.rsvpEnabled ? " (RSVPs turned off)" : ""}
              </option>
            ))}
          </select>
        </div>
        {scopeLocked && <p className="text-xs text-ink-muted">Who answers can&apos;t be changed because {lockReason}.</p>}
        {state?.errors?.scope && <p className="text-sm text-bad">{state.errors.scope}</p>}
        {state?.errors?.eventId && <p className="text-sm text-bad">{state.errors.eventId}</p>}

        {showFollowUp ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink">
              <span>only if they answered</span>
              {selectedParent ? (
                <select
                  aria-label="The answer that shows this question"
                  id="parentOptionId"
                  name="parentOptionId"
                  value={parentOptionId}
                  onChange={(e) => setParentOptionId(e.target.value)}
                  aria-invalid={!!state?.errors?.parentOptionId || undefined}
                  className={inlineSelect}
                >
                  <option value="">choose an answer…</option>
                  {selectedParent.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      “{o.label}”
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-ink-muted">…</span>
              )}
              <span>to</span>
              <select
                aria-label="The question this follows"
                id="parentQuestionId"
                name="parentQuestionId"
                value={parentQuestionId}
                onChange={(e) => {
                  setParentQuestionId(e.target.value);
                  setParentOptionId("");
                }}
                aria-invalid={!!state?.errors?.parentQuestionId || undefined}
                className={inlineSelect}
              >
                <option value="">choose a question…</option>
                {scopedParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    “{p.label}”
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFollowUpOpen(false);
                  setParentQuestionId("");
                  setParentOptionId("");
                }}
              >
                Not a follow-up
              </Button>
            </div>
            {(state?.errors?.parentQuestionId || state?.errors?.parentOptionId) && (
              <p className="text-sm text-bad">{state?.errors?.parentQuestionId ?? state?.errors?.parentOptionId}</p>
            )}
          </div>
        ) : (
          scopedParents.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setFollowUpOpen(true)}>
              Make this a follow-up to another question
            </Button>
          )
        )}

        <AudiencePicker
          name="audience"
          tags={tags}
          defaultValue={initial.audience}
          legend="Which guests"
          everyoneLabel="Everyone it applies to"
          tagsLabel="Only guests with certain tags"
          error={state?.errors?.audience}
        />

        <Checkbox
          id="required"
          name="required"
          label="They must answer"
          hint="Guests can't send their RSVP until they've answered this."
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
      </fieldset>

      {isEditing && childCount > 0 && (
        <Notice tone="info">
          {childCount === 1
            ? "1 follow-up question depends on this question."
            : `${childCount} follow-up questions depend on this question.`}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <LinkButton href="/admin/rsvp/questions" variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
