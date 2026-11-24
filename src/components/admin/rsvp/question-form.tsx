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
  Select,
  SubmitButton,
} from "@/components/ui";
import type { Audience, QuestionOption, QuestionType } from "@/db/schema";
import type { ActionState } from "@/lib/forms";
import { eligibleParentQuestions, type ExistingQuestionRef } from "@/lib/rsvp-admin/validation";

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
  const scopeLocked = isEditing && (answerCount > 0 || childCount > 0);
  const lockReason =
    answerCount > 0
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
        label="Answer type"
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
              {type === "choice" ? "Multiple choice" : "Short answer"}
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                id="type-choice"
                type="radio"
                name="type"
                value="choice"
                checked={type === "choice"}
                onChange={() => setType("choice")}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                <span className="font-medium text-ink">Multiple choice</span>
                <span className="block text-ink-muted">
                  Guests pick one option (e.g. meal choice or yes/no).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                id="type-text"
                type="radio"
                name="type"
                value="text"
                checked={type === "text"}
                onChange={() => setType("text")}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                <span className="font-medium text-ink">Short answer</span>
                <span className="block text-ink-muted">
                  Guests type their own reply (e.g. allergies or song request).
                </span>
              </span>
            </label>
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
                  {hasAnswers && (
                    <p className="text-xs text-ink-muted">
                      Already chosen by guests — you can rename this option, but not remove it.
                    </p>
                  )}
                  {!hasAnswers && hasFollowUps && (
                    <p className="text-xs text-ink-muted">
                      Used by a follow-up question — update the follow-up first to remove it.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-1">
            <Button variant="secondary" size="sm" onClick={addOption}>
              Add option
            </Button>
          </div>

          {state?.errors?.options && (
            <p className="text-sm text-bad">{state.errors.options}</p>
          )}
        </div>
      )}

      <Checkbox
        id="required"
        name="required"
        label="Required"
        hint="Guests must answer this question before submitting their RSVP."
        checked={required}
        onChange={(e) => setRequired(e.target.checked)}
      />

      <Field
        label="Who answers"
        htmlFor="scope-guest"
        error={state?.errors?.scope}
        hint={
          scopeLocked
            ? `Can't be changed because ${lockReason}.`
            : undefined
        }
      >
        {scopeLocked ? (
          <>
            <input type="hidden" name="scope" value={scope} />
            <p className="rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-ink">
              {scope === "household" ? "Ask once per household" : "Ask each guest"}
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                id="scope-guest"
                type="radio"
                name="scope"
                value="guest"
                checked={scope === "guest"}
                onChange={() => handleScopeChange("guest")}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                <span className="font-medium text-ink">Ask each guest</span>
                <span className="block text-ink-muted">
                  Each person in the household gives their own answer.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                id="scope-household"
                type="radio"
                name="scope"
                value="household"
                checked={scope === "household"}
                onChange={() => handleScopeChange("household")}
                className="mt-0.5 size-4 accent-brand"
              />
              <span>
                <span className="font-medium text-ink">Ask once per household</span>
                <span className="block text-ink-muted">
                  One shared answer for the whole household (e.g. a song request).
                </span>
              </span>
            </label>
          </div>
        )}
      </Field>

      <div className="space-y-5 border-t border-line pt-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">When to ask this question</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Leave these blank to ask everyone who replies.
          </p>
        </div>

        <Field
          label="Only ask guests attending…"
          htmlFor="eventId"
          optional
          error={state?.errors?.eventId}
          hint={
            scope === "household"
              ? "Asked when at least one person in the household is attending this event."
              : "Only shown to guests who say they are attending this event."
          }
        >
          <Select
            id="eventId"
            name="eventId"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            invalid={!!state?.errors?.eventId}
          >
            <option value="">Anyone coming to at least one event</option>
            {selectableEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {!ev.rsvpEnabled ? " (RSVPs turned off)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-3">
          <Field
            label="Only ask if…"
            htmlFor="parentQuestionId"
            optional
            error={state?.errors?.parentQuestionId}
            hint={
              scopedParents.length === 0
                ? `No other ${scope === "household" ? "per-household" : "per-guest"} multiple-choice questions available yet.`
                : "Show this as a follow-up to another multiple-choice question with the same scope."
            }
          >
            <Select
              id="parentQuestionId"
              name="parentQuestionId"
              value={parentQuestionId}
              onChange={(e) => {
                setParentQuestionId(e.target.value);
                setParentOptionId("");
              }}
              invalid={!!state?.errors?.parentQuestionId}
              disabled={scopedParents.length === 0 && !parentQuestionId}
            >
              <option value="">Always ask (not a follow-up)</option>
              {scopedParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          {selectedParent && (
            <Field
              label="They answered"
              htmlFor="parentOptionId"
              error={state?.errors?.parentOptionId}
            >
              <Select
                id="parentOptionId"
                name="parentOptionId"
                value={parentOptionId}
                onChange={(e) => setParentOptionId(e.target.value)}
                invalid={!!state?.errors?.parentOptionId}
              >
                <option value="">Choose an option…</option>
                {selectedParent.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Who's asked" htmlFor="audienceMode" error={state?.errors?.audience}>
          <AudiencePicker
            name="audience"
            tags={tags}
            defaultValue={initial.audience}
            everyoneLabel="Everyone"
            tagsLabel="Only guests with these tags"
          />
        </Field>
      </div>

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
