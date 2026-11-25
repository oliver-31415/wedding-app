"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Card, CardBody, Input, Notice, Textarea, cn } from "@/components/ui";
import { formatDateLong, formatTimeRange } from "@/lib/dates";
import {
  answerKey,
  attendanceKey,
  householdLabel,
  rsvpEventsFor,
  rsvpEventsForHousehold,
  visibleQuestions,
  type SnapGuest,
  type SnapHousehold,
  type SnapQuestion,
} from "@/lib/rsvp/model";
import { DietaryControl } from "./dietary-control";
import {
  buildDraft,
  buildVirtualGuests,
  displayGuestName,
  errorDomId,
  firstErrorKey,
  nextPlusOneTempId,
  orderedFormErrorKeys,
  pruneGuestFromFormState,
  toSubmissionInput,
  type EventDetail,
  type GuestFormState,
} from "@/lib/rsvp-guest/form-model";
import type { ConfirmationSummary } from "@/lib/rsvp-guest/summary";
import { submitRsvpAction } from "./actions";
import { NotYouButton } from "./not-you-button";

export function RsvpForm({
  weddingId,
  slug,
  household,
  mainGuests,
  events,
  questions,
  initialState,
  isEditing,
  partialReminder = false,
  deadline,
  notYouRedirectTo = null,
  onSaved,
  onCancelEdit,
  lockAnswered = false,
}: {
  weddingId: string;
  slug: string;
  household: SnapHousehold;
  mainGuests: SnapGuest[];
  events: EventDetail[];
  questions: SnapQuestion[];
  initialState: GuestFormState;
  isEditing: boolean;
  partialReminder?: boolean;
  deadline: string | null;
  notYouRedirectTo?: string | null;
  onSaved: (res: {
    firstResponse: boolean;
    summary: ConfirmationSummary;
    initialFormState: GuestFormState;
  }) => void;
  onCancelEdit?: () => void;
  /**
   * The couple doesn't allow changes, but something new needs an answer (e.g.
   * an event added later): what was already answered is shown but locked.
   * The server enforces the same rule (lockAnswered in src/lib/rsvp/save.ts).
   */
  lockAnswered?: boolean;
}) {
  const router = useRouter();
  const [formState, setFormState] = useState<GuestFormState>(initialState);
  const [lockedKeys] = useState(
    () => new Set(lockAnswered ? [...Object.keys(initialState.attendance), ...Object.keys(initialState.answers)] : []),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const virtualGuests = buildVirtualGuests(mainGuests, formState.plusOnes, household.id);
  const label = householdLabel(household, virtualGuests);
  const rsvpEvents = rsvpEventsForHousehold(virtualGuests, events);
  const draft = buildDraft(formState.attendance, formState.answers);
  const visible = visibleQuestions(questions, virtualGuests, events, draft);

  const plusOneIndexById = new Map(formState.plusOnes.map((p, idx) => [p.id, idx]));

  function clearError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setAttendance(guestId: string, eventId: string, attending: boolean) {
    const key = attendanceKey(guestId, eventId);
    if (lockedKeys.has(key)) return;
    setFormState((prev) => ({
      ...prev,
      attendance: { ...prev.attendance, [key]: attending },
    }));
    clearError(`attendance.${guestId}.${eventId}`);
  }

  function setAnswer(questionId: string, guestId: string | null, value: string) {
    const key = answerKey(questionId, guestId);
    if (lockedKeys.has(key)) return;
    setFormState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [key]: value },
    }));
    clearError(`answer.${questionId}.${guestId ?? "household"}`);
  }

  function addPlusOne() {
    if (formState.plusOnes.length >= household.plusOnesAllowed) return;
    const tempId = nextPlusOneTempId(formState.plusOnes);
    setFormState((prev) => ({
      ...prev,
      plusOnes: [...prev.plusOnes, { id: tempId, firstName: "", lastName: "" }],
    }));
    clearError("plusOnes");
  }

  function updatePlusOne(index: number, field: "firstName" | "lastName", value: string) {
    setFormState((prev) => ({
      ...prev,
      plusOnes: prev.plusOnes.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }));
    clearError(`plusOne.${index}`);
  }

  function removePlusOne(id: string, index: number) {
    setFormState((prev) => pruneGuestFromFormState(prev, id));
    setErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (k === `plusOne.${index}` || k === "plusOnes") continue;
        if (k.startsWith(`attendance.${id}.`)) continue;
        if (k.endsWith(`.${id}`)) continue;
        next[k] = v;
      }
      return next;
    });
  }

  function scrollToError(nextErrors: Record<string, string>) {
    const ordered = orderedFormErrorKeys({
      plusOnesCount: formState.plusOnes.length,
      virtualGuests,
      events,
      questions,
      draft,
    });
    const first = firstErrorKey(nextErrors, ordered);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(errorDomId(first));
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el.querySelector<HTMLElement>("input, textarea, button");
      focusable?.focus({ preventScroll: true });
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormMessage(null);
    const input = toSubmissionInput(formState);

    startTransition(async () => {
      const res = await submitRsvpAction({ weddingId, input });
      if (!res.ok) {
        setErrors(res.errors);
        setFormMessage(res.message);
        scrollToError(res.errors);
        return;
      }
      setErrors({});
      setFormMessage(null);
      onSaved({
        firstResponse: res.firstResponse,
        summary: res.summary,
        initialFormState: res.initialFormState,
      });
      router.refresh();
    });
  }

  const perGuestWithQuestions = visible.perGuest.filter((entry) => entry.questions.length > 0);
  const hasAnyQuestions = perGuestWithQuestions.length > 0 || visible.household.length > 0;

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-8" noValidate>
      {/* Greeting header */}
      <div className="space-y-2 border-b border-line pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Hi, {label}
          </h2>
          <div className="flex items-center gap-4">
            {isEditing && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex min-h-9 items-center text-sm text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
              >
                Cancel
              </button>
            )}
            <NotYouButton weddingId={weddingId} slug={slug} redirectTo={notYouRedirectTo} />
          </div>
        </div>
        {deadline && (
          <p className="text-sm text-ink-muted">
            Please respond by <span className="font-medium text-ink">{formatDateLong(deadline)}</span>.
          </p>
        )}
      </div>

      {partialReminder && (
        <Notice tone="info">
          {lockAnswered
            ? "There’s something new to reply to. Your earlier answers are locked — contact the couple if they need to change."
            : "Some events still need a reply. Please check your responses below and save to finish."}
        </Notice>
      )}

      {formMessage && <Notice tone="bad">{formMessage}</Notice>}

      {/* Plus-ones (shown before events so added guests appear right below) */}
      {household.plusOnesAllowed > 0 && (
        <div id={errorDomId("plusOnes")} className="scroll-mt-8">
        <Card>
          <CardBody className="space-y-5 p-6 sm:p-7">
            <div className="space-y-1">
              <h3 className="font-serif text-2xl font-medium text-ink">Additional guests</h3>
              <p className="text-sm text-ink-muted">
                You&apos;re welcome to bring {household.plusOnesAllowed}{" "}
                {household.plusOnesAllowed === 1 ? "guest" : "guests"}.
              </p>
            </div>

            {errors.plusOnes && (
              <p role="alert" className="text-sm text-bad">
                {errors.plusOnes}
              </p>
            )}

            {formState.plusOnes.length > 0 && (
              <div className="space-y-4">
                {formState.plusOnes.map((p, i) => {
                  const rowError = errors[`plusOne.${i}`];
                  return (
                    <div
                      key={p.id}
                      id={errorDomId(`plusOne.${i}`)}
                      className={cn(
                        "scroll-mt-8 rounded-xl border p-4 space-y-3",
                        rowError ? "border-bad bg-bad-soft/30" : "border-line bg-canvas/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          Guest {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePlusOne(p.id, i)}
                          className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm text-bad transition-colors hover:bg-bad-soft"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label
                            htmlFor={`plusone-first-${i}`}
                            className="block text-sm font-medium text-ink"
                          >
                            First name
                          </label>
                          <Input
                            id={`plusone-first-${i}`}
                            type="text"
                            value={p.firstName}
                            onChange={(e) => updatePlusOne(i, "firstName", e.target.value)}
                            invalid={!!rowError}
                            className="h-11 text-base focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`plusone-last-${i}`}
                            className="block text-sm font-medium text-ink"
                          >
                            Last name
                          </label>
                          <Input
                            id={`plusone-last-${i}`}
                            type="text"
                            value={p.lastName}
                            onChange={(e) => updatePlusOne(i, "lastName", e.target.value)}
                            invalid={!!rowError}
                            className="h-11 text-base focus:border-accent"
                          />
                        </div>
                      </div>
                      {rowError && (
                        <p role="alert" className="text-sm text-bad">
                          {rowError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {formState.plusOnes.length < household.plusOnesAllowed && (
              <button
                type="button"
                onClick={addPlusOne}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent sm:w-auto"
              >
                + Add guest
              </button>
            )}
          </CardBody>
        </Card>
        </div>
      )}

      {/* Events & attendance */}
      <div className="space-y-5">
        {rsvpEvents.map((ev) => {
          const detail = events.find((e) => e.id === ev.id);
          const invitedGuests = virtualGuests.filter(
            (g) => rsvpEventsFor(g, [ev], virtualGuests).length > 0,
          );
          return (
            <Card key={ev.id}>
              <CardBody className="space-y-5 p-6 sm:p-7">
                <div className="space-y-1 border-b border-line pb-4">
                  <h3 className="font-serif text-2xl font-medium text-ink">{ev.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                    {detail?.startsAt ? (
                      <>
                        <span>{formatDateLong(detail.startsAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTimeRange(detail.startsAt, detail.endsAt)}</span>
                      </>
                    ) : (
                      <span>{formatTimeRange(null, null)}</span>
                    )}
                    {detail?.venueName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{detail.venueName}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-line">
                  {invitedGuests.map((guest) => {
                    const aKey = attendanceKey(guest.id, ev.id);
                    const value = formState.attendance[aKey];
                    const errKey = `attendance.${guest.id}.${ev.id}`;
                    const errMsg = errors[errKey];
                    const guestLabel = displayGuestName(guest, plusOneIndexById.get(guest.id));

                    return (
                      <div
                        key={guest.id}
                        id={errorDomId(errKey)}
                        className="scroll-mt-8 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-medium text-ink">{guestLabel}</span>
                            {guest.ageGroup === "child" && <Badge tone="neutral">Child</Badge>}
                            {guest.isPlusOne && <Badge tone="neutral">Plus-one</Badge>}
                          </div>

                          <div
                            role="radiogroup"
                            aria-label={`${guestLabel} attendance for ${ev.name}`}
                            className="grid grid-cols-2 gap-2 sm:min-w-[270px]"
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={value === true}
                              disabled={lockedKeys.has(aKey)}
                              onClick={() => setAttendance(guest.id, ev.id, true)}
                              className={cn(
                                "min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                value === true
                                  ? "border-accent bg-accent text-white shadow-xs"
                                  : errMsg
                                    ? "border-bad/60 bg-surface text-ink hover:border-accent hover:bg-accent/5"
                                    : "border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent/5",
                              )}
                            >
                              Attending
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={value === false}
                              disabled={lockedKeys.has(aKey)}
                              onClick={() => setAttendance(guest.id, ev.id, false)}
                              className={cn(
                                "min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                value === false
                                  ? "border-ink bg-ink text-white shadow-xs"
                                  : errMsg
                                    ? "border-bad/60 bg-surface text-ink hover:bg-sunken"
                                    : "border-line-strong bg-surface text-ink hover:bg-sunken",
                              )}
                            >
                              Can&apos;t make it
                            </button>
                          </div>
                        </div>

                        {errMsg && (
                          <p role="alert" className="mt-2 text-sm text-bad">
                            {errMsg}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Dynamic questions (per-guest & household) */}
      {hasAnyQuestions && (
        <div className="space-y-5">
          {perGuestWithQuestions.map(({ guest, questions: qs }) => {
            const guestLabel = displayGuestName(guest, plusOneIndexById.get(guest.id));
            return (
              <Card key={guest.id}>
                <CardBody className="space-y-6 p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
                    <h3 className="font-serif text-2xl font-medium text-ink">{guestLabel}</h3>
                    {guest.ageGroup === "child" && <Badge tone="neutral">Child</Badge>}
                    {guest.isPlusOne && <Badge tone="neutral">Plus-one</Badge>}
                  </div>

                  <div className="space-y-6">
                    {qs.map((q) => (
                      <QuestionControl
                        key={q.id}
                        question={q}
                        targetId={guest.id}
                        value={formState.answers[answerKey(q.id, guest.id)] ?? ""}
                        locked={lockedKeys.has(answerKey(q.id, guest.id))}
                        error={errors[`answer.${q.id}.${guest.id}`]}
                        onChange={(val) => setAnswer(q.id, guest.id, val)}
                      />
                    ))}
                  </div>
                </CardBody>
              </Card>
            );
          })}

          {visible.household.length > 0 && (
            <Card>
              <CardBody className="space-y-6 p-6 sm:p-7">
                <div className="border-b border-line pb-3">
                  <h3 className="font-serif text-2xl font-medium text-ink">For your household</h3>
                </div>
                <div className="space-y-6">
                  {visible.household.map((q) => (
                    <QuestionControl
                      key={q.id}
                      question={q}
                      targetId="household"
                      value={formState.answers[answerKey(q.id, null)] ?? ""}
                      locked={lockedKeys.has(answerKey(q.id, null))}
                      error={errors[`answer.${q.id}.household`]}
                      onChange={(val) => setAnswer(q.id, null, val)}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Note to the couple */}
      <div id={errorDomId("note")} className="scroll-mt-8">
        <Card>
          <CardBody className="space-y-3 p-6 sm:p-7">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="rsvp-note-textarea" className="font-serif text-2xl font-medium text-ink">
                Note to the couple
              </label>
              <span className="text-xs text-ink-faint">Optional</span>
            </div>
            <Textarea
              id="rsvp-note-textarea"
              rows={3}
              value={formState.note}
              onChange={(e) => {
                setFormState((prev) => ({ ...prev, note: e.target.value }));
                clearError("note");
              }}
              invalid={!!errors.note}
              className="text-base focus:border-accent"
            />
            {errors.note && (
              <p role="alert" className="text-sm text-bad">
                {errors.note}
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Submit */}
      <div className="space-y-4">
        {formMessage && <Notice tone="bad">{formMessage}</Notice>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-8 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {isPending
              ? isEditing
                ? "Updating…"
                : "Sending…"
              : isEditing
                ? "Update RSVP"
                : "Send RSVP"}
          </button>
          {isEditing && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isPending}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-surface px-6 text-base font-medium text-ink transition-colors hover:bg-sunken disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function QuestionControl({
  question,
  targetId,
  value,
  error,
  onChange,
  locked = false,
}: {
  question: SnapQuestion;
  targetId: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  locked?: boolean;
}) {
  const errKey = `answer.${question.id}.${targetId}`;
  const domId = errorDomId(errKey);
  const inputId = `${domId}-input`;
  const isFollowUp = !!question.parentQuestionId;

  return (
    <div
      id={domId}
      className={cn(
        "scroll-mt-8 space-y-2.5",
        isFollowUp && "border-l-2 border-accent/30 pl-4",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {question.type === "text" ? (
          <label htmlFor={inputId} className="text-sm font-medium text-ink sm:text-base">
            {question.label}
          </label>
        ) : (
          <span id={`${domId}-label`} className="text-sm font-medium text-ink sm:text-base">
            {question.label}
          </span>
        )}
        {question.required ? (
          <span className="text-xs font-medium text-accent">Required</span>
        ) : (
          <span className="text-xs text-ink-faint">Optional</span>
        )}
      </div>

      {question.type === "dietary" ? (
        <DietaryControl
          id={inputId}
          labelledBy={`${domId}-label`}
          value={value}
          invalid={!!error}
          locked={locked}
          onChange={onChange}
        />
      ) : question.type === "choice" ? (
        <div
          role="radiogroup"
          aria-labelledby={`${domId}-label`}
          className="grid gap-2.5"
        >
          {question.options.map((opt) => {
            const selected = value === opt.id;
            return (
              <label
                key={opt.id}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors sm:text-base",
                  selected
                    ? "border-accent bg-accent/8 font-medium text-ink"
                    : error
                      ? "border-bad/60 bg-surface text-ink hover:border-accent/60"
                      : "border-line-strong bg-surface text-ink hover:border-accent/60 hover:bg-canvas",
                )}
              >
                <input
                  type="radio"
                  name={inputId}
                  value={opt.id}
                  checked={selected}
                  disabled={locked}
                  onChange={() => onChange(opt.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    selected ? "border-accent bg-accent" : "border-line-strong bg-surface",
                  )}
                >
                  {selected && <span className="size-2 rounded-full bg-white" />}
                </span>
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <Textarea
          id={inputId}
          rows={3}
          value={value}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!error}
          className="text-base focus:border-accent"
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
