"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Table,
  Td,
  Th,
  Textarea,
  cn,
} from "@/components/ui";
import { saveHostRsvpAction } from "@/app/admin/guests/actions";
import { DietaryControl } from "@/components/site/rsvp/dietary-control";
import { GUEST_EVENT_STATUS_META, HOUSEHOLD_STATE_META } from "@/lib/guests/status";
import {
  answerKey,
  attendanceKey,
  guestEventStatus,
  householdRsvpState,
  responsesMap,
  rsvpEventsFor,
  rsvpEventsForHousehold,
  visibleQuestions,
  type Draft,
  type SnapAnswer,
  type SnapEvent,
  type SnapGuest,
  type SnapQuestion,
  type SnapResponse,
  usableAnswers,
} from "@/lib/rsvp/model";

type AttendanceChoice = "attending" | "declined" | "none";

function buildInitialAttendance(responses: SnapResponse[]): Record<string, AttendanceChoice> {
  const out: Record<string, AttendanceChoice> = {};
  for (const r of responses) {
    out[attendanceKey(r.guestId, r.eventId)] = r.attending ? "attending" : "declined";
  }
  return out;
}

function buildInitialAnswers(answers: SnapAnswer[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of answers) {
    out[answerKey(a.questionId, a.guestId)] = a.value;
  }
  return out;
}

export function HostRsvpEditor({
  householdId,
  guests,
  events,
  questions,
  initialResponses,
  initialAnswers,
}: {
  householdId: string;
  guests: SnapGuest[];
  events: SnapEvent[];
  questions: SnapQuestion[];
  initialResponses: SnapResponse[];
  initialAnswers: SnapAnswer[];
}) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceChoice>>(() =>
    buildInitialAttendance(initialResponses),
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildInitialAnswers(usableAnswers(initialAnswers, questions)));
  const [note, setNote] = useState("");

  // Sync draft state when server data changes after save or household member changes
  const serverSig = JSON.stringify({
    guestIds: guests.map((g) => g.id),
    initialResponses,
    initialAnswers,
  });
  const [prevServerSig, setPrevServerSig] = useState(serverSig);
  if (prevServerSig !== serverSig) {
    setPrevServerSig(serverSig);
    setAttendance(buildInitialAttendance(initialResponses));
    setAnswers(buildInitialAnswers(usableAnswers(initialAnswers, questions)));
    setNote("");
  }

  const boundSave = saveHostRsvpAction.bind(null, householdId);
  const [state, formAction] = useActionState(boundSave, null);

  // Current stored status summary (reflects saved DB state)
  const savedRespMap = useMemo(() => responsesMap(initialResponses), [initialResponses]);
  const savedHouseholdState = useMemo(
    () => householdRsvpState(guests, events, savedRespMap),
    [guests, events, savedRespMap],
  );
  const householdEvents = useMemo(() => rsvpEventsForHousehold(guests, events), [guests, events]);

  // Live Draft evaluated through visibleQuestions from src/lib/rsvp/model.ts
  const draft: Draft = useMemo(() => {
    const attMap = new Map<string, boolean>();
    for (const [k, v] of Object.entries(attendance)) {
      if (v === "attending") attMap.set(k, true);
      else if (v === "declined") attMap.set(k, false);
    }
    const ansMap = new Map<string, string>();
    for (const [k, v] of Object.entries(answers)) {
      const trimmed = v.trim();
      if (trimmed !== "") ansMap.set(k, trimmed);
    }
    return { attendance: attMap, answers: ansMap };
  }, [attendance, answers]);

  const visible = useMemo(
    () => visibleQuestions(questions, guests, events, draft),
    [questions, guests, events, draft],
  );

  // Build submission JSON for saveRsvp({ source: "host" })
  const submissionJson = useMemo(() => {
    const attList: { guestId: string; eventId: string; attending: boolean }[] = [];
    for (const g of guests) {
      for (const ev of rsvpEventsFor(g, events, guests)) {
        const val = attendance[attendanceKey(g.id, ev.id)] ?? "none";
        if (val === "attending") attList.push({ guestId: g.id, eventId: ev.id, attending: true });
        else if (val === "declined") attList.push({ guestId: g.id, eventId: ev.id, attending: false });
      }
    }

    const ansList: { questionId: string; guestId: string | null; value: string }[] = [];
    for (const q of visible.household) {
      const v = (answers[answerKey(q.id, null)] ?? "").trim();
      if (v !== "") ansList.push({ questionId: q.id, guestId: null, value: v });
    }
    for (const { guest, questions: qs } of visible.perGuest) {
      for (const q of qs) {
        const v = (answers[answerKey(q.id, guest.id)] ?? "").trim();
        if (v !== "") ansList.push({ questionId: q.id, guestId: guest.id, value: v });
      }
    }

    return JSON.stringify({
      attendance: attList,
      answers: ansList,
      note: note.trim() || null,
    });
  }, [guests, events, attendance, visible, answers, note]);

  const stateMeta = HOUSEHOLD_STATE_META[savedHouseholdState];
  const hasVisibleGuestQuestions = visible.perGuest.some((entry) => entry.questions.length > 0);

  return (
    <Card>
      <CardHeader
        title="RSVP"
        description="Current attendance status and host RSVP editor. Partial answers can be saved at any time."
        actions={<Badge tone={stateMeta.tone}>{stateMeta.label}</Badge>}
      />
      <CardBody className="space-y-6">
        {/* Per-guest per-event status table */}
        {householdEvents.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Current status</h3>
            <div className="rounded-xl border border-line">
              <Table>
                <thead>
                  <tr>
                    <Th>Guest</Th>
                    {householdEvents.map((ev) => (
                      <Th key={ev.id}>{ev.name}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id}>
                      <Td className="font-medium text-ink">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span>
                            {g.firstName} {g.lastName}
                          </span>
                          {g.ageGroup === "child" && <Badge tone="info">Child</Badge>}
                          {g.isPlusOne && <Badge tone="brand">Plus-one</Badge>}
                        </span>
                      </Td>
                      {householdEvents.map((ev) => {
                        const status = guestEventStatus(g, ev, guests, savedRespMap);
                        const meta = GUEST_EVENT_STATUS_META[status];
                        return (
                          <Td key={ev.id}>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            None of the guests in this household are currently invited to an RSVP-enabled event.
          </p>
        )}

        {/* Edit RSVP form */}
        <form action={formAction} className="max-w-2xl space-y-6 border-t border-line pt-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Edit RSVP</h3>
            <p className="text-xs text-ink-muted">
              Update attendance or answers on the household’s behalf. Follow-up questions appear automatically as you
              change answers.
            </p>
          </div>

          <FormMessage state={state} />
          {state?.errors?.plusOnes && <p className="text-sm text-bad">{state.errors.plusOnes}</p>}
          <input type="hidden" name="rsvpJson" value={submissionJson} />

          {/* Attendance controls per guest per RSVP event */}
          {householdEvents.length > 0 && (
            <div className="space-y-4">
              {guests.map((g) => {
                const invitedEvents = rsvpEventsFor(g, events, guests);
                if (invitedEvents.length === 0) return null;
                return (
                  <div key={g.id} className="space-y-3 rounded-xl border border-line bg-canvas/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {g.firstName} {g.lastName}
                      </p>
                      {g.ageGroup === "child" && <Badge tone="info">Child</Badge>}
                      {g.isPlusOne && <Badge tone="brand">Plus-one</Badge>}
                    </div>
                    <div className="space-y-3">
                      {invitedEvents.map((ev) => {
                        const key = attendanceKey(g.id, ev.id);
                        const current = attendance[key] ?? "none";
                        const fieldErr = state?.errors?.[`attendance.${g.id}.${ev.id}`];

                        return (
                          <div key={ev.id} className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm text-ink">{ev.name}</span>
                              <div
                                role="radiogroup"
                                aria-label={`${g.firstName} ${g.lastName} — ${ev.name}`}
                                className="flex flex-wrap gap-1.5"
                              >
                                {(
                                  [
                                    { value: "attending", label: "Attending", active: "border-good bg-good-soft text-good" },
                                    { value: "declined", label: "Declined", active: "border-bad bg-bad-soft text-bad" },
                                    { value: "none", label: "No answer", active: "border-line-strong bg-sunken text-ink" },
                                  ] as const
                                ).map((opt) => (
                                  <label
                                    key={opt.value}
                                    className={cn(
                                      "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                                      current === opt.value
                                        ? opt.active
                                        : "border-line bg-surface text-ink-muted hover:bg-sunken hover:text-ink",
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={`att-${g.id}-${ev.id}`}
                                      value={opt.value}
                                      checked={current === opt.value}
                                      onChange={() =>
                                        setAttendance((prev) => ({
                                          ...prev,
                                          [key]: opt.value,
                                        }))
                                      }
                                      className="sr-only"
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                            {fieldErr && <p className="text-xs text-bad">{fieldErr}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-guest visible questions */}
          {hasVisibleGuestQuestions && (
            <div className="space-y-4 border-t border-line pt-5">
              <h4 className="text-sm font-semibold text-ink">Guest questions</h4>
              {visible.perGuest.map(({ guest, questions: qs }) => {
                if (qs.length === 0) return null;
                return (
                  <div key={guest.id} className="space-y-4 rounded-xl border border-line bg-canvas/50 p-4">
                    <p className="text-sm font-semibold text-ink">
                      {guest.firstName} {guest.lastName}
                    </p>
                    {qs.map((q) => {
                      const aKey = answerKey(q.id, guest.id);
                      const errKey = `answer.${q.id}.${guest.id}`;
                      const err = state?.errors?.[errKey];
                      const val = answers[aKey] ?? "";
                      const inputId = `q-${q.id}-${guest.id}`;
                      if (q.type === "dietary") {
                        return (
                          <div key={q.id} className="space-y-1.5">
                            <p id={`${inputId}-label`} className="text-sm font-medium text-ink">
                              {q.label}
                              {!q.required && <span className="ml-1.5 font-normal text-ink-faint">Optional</span>}
                            </p>
                            <DietaryControl
                              id={inputId}
                              labelledBy={`${inputId}-label`}
                              value={val}
                              invalid={!!err}
                              locked={false}
                              onChange={(next) => setAnswers((prev) => ({ ...prev, [aKey]: next }))}
                            />
                            {err && <p className="text-sm text-bad">{err}</p>}
                          </div>
                        );
                      }
                      return (
                        <Field
                          key={q.id}
                          label={q.label}
                          htmlFor={inputId}
                          optional={!q.required}
                          error={err}
                        >
                          {q.type === "choice" ? (
                            <Select
                              id={inputId}
                              value={val}
                              invalid={!!err}
                              onChange={(e) => setAnswers((prev) => ({ ...prev, [aKey]: e.target.value }))}
                            >
                              <option value="">No answer</option>
                              {q.options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              id={inputId}
                              value={val}
                              invalid={!!err}
                              onChange={(e) => setAnswers((prev) => ({ ...prev, [aKey]: e.target.value }))}
                              placeholder="Enter answer"
                            />
                          )}
                        </Field>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Household-scope visible questions */}
          {visible.household.length > 0 && (
            <div className="space-y-4 border-t border-line pt-5">
              <h4 className="text-sm font-semibold text-ink">Household questions</h4>
              <div className="space-y-4 rounded-xl border border-line bg-canvas/50 p-4">
                {visible.household.map((q) => {
                  const aKey = answerKey(q.id, null);
                  const errKey = `answer.${q.id}.household`;
                  const err = state?.errors?.[errKey];
                  const val = answers[aKey] ?? "";
                  const inputId = `q-${q.id}-household`;
                  return (
                    <Field
                      key={q.id}
                      label={q.label}
                      htmlFor={inputId}
                      optional={!q.required}
                      error={err}
                    >
                      {q.type === "choice" ? (
                        <Select
                          id={inputId}
                          value={val}
                          invalid={!!err}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [aKey]: e.target.value }))}
                        >
                          <option value="">No answer</option>
                          {q.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          id={inputId}
                          value={val}
                          invalid={!!err}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [aKey]: e.target.value }))}
                          placeholder="Enter answer"
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
            </div>
          )}

          {/* Host activity note */}
          <div className="border-t border-line pt-5">
            <Field
              label="Activity note"
              htmlFor="rsvp-host-note"
              optional
              hint="Recorded in this household’s RSVP activity log."
              error={state?.errors?.note}
            >
              <Textarea
                id="rsvp-host-note"
                rows={2}
                value={note}
                invalid={!!state?.errors?.note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Confirmed over the phone"
              />
            </Field>
          </div>

          <SubmitButton pendingLabel="Saving RSVP…">Save RSVP</SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
