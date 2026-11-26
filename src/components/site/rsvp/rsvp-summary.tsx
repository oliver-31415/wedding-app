"use client";

import { Badge, Card, CardBody, Notice, TextBlock } from "@/components/ui";
import { formatDateLong, formatTimeRange } from "@/lib/dates";
import type { ConfirmationSummary } from "@/lib/rsvp-guest/summary";
import { NotYouButton } from "./not-you-button";

export function RsvpSummary({
  weddingId,
  slug,
  summary,
  canEdit,
  justSubmitted = null,
  notYouRedirectTo = null,
  onEdit,
}: {
  weddingId: string;
  slug: string;
  summary: ConfirmationSummary;
  canEdit: boolean;
  justSubmitted?: "first" | "update" | null;
  notYouRedirectTo?: string | null;
  onEdit?: () => void;
}) {
  const hasAnswers = summary.guestAnswers.length > 0 || summary.householdAnswers.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-7">
      {justSubmitted && (
        <Notice tone="good" title={justSubmitted === "first" ? "Thank you — your RSVP is in." : "Your RSVP has been updated."}>
          {summary.anyAttending
            ? "We can't wait to celebrate with you. A copy of your response has been emailed if we have your address on file."
            : "Thank you for letting us know. A copy of your response has been emailed if we have your address on file."}
        </Notice>
      )}

      <div className="space-y-1 border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            {summary.householdLabel}
          </h2>
          <NotYouButton weddingId={weddingId} slug={slug} redirectTo={notYouRedirectTo} />
        </div>
        <p className="text-sm text-ink-muted">Here is a summary of your RSVP.</p>
      </div>

      {/* Events */}
      <div className="space-y-4">
        {summary.events.map((ev) => (
          <Card key={ev.id}>
            <CardBody className="space-y-4 p-6 sm:p-7">
              <div className="space-y-1 border-b border-line pb-3">
                <h3 className="font-serif text-2xl font-medium text-ink">{ev.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                  {ev.startsAt ? (
                    <>
                      <span>{formatDateLong(ev.startsAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatTimeRange(ev.startsAt, ev.endsAt)}</span>
                    </>
                  ) : (
                    <span>{formatTimeRange(null, null)}</span>
                  )}
                  {ev.venueName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{ev.venueName}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {ev.attending.length > 0 && (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <div className="shrink-0">
                      <Badge tone="good">Attending</Badge>
                    </div>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink sm:text-base">
                      {ev.attending.map((g) => (
                        <li key={g.id} className="inline-flex items-center gap-1.5">
                          <span>{g.name}</span>
                          {g.ageGroup === "child" && (
                            <span className="text-xs text-ink-muted">(Child)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev.declined.length > 0 && (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <div className="shrink-0">
                      <Badge tone="bad">Can&apos;t make it</Badge>
                    </div>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted sm:text-base">
                      {ev.declined.map((g) => (
                        <li key={g.id} className="inline-flex items-center gap-1.5">
                          <span>{g.name}</span>
                          {g.ageGroup === "child" && (
                            <span className="text-xs text-ink-faint">(Child)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev.pending.length > 0 && (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <div className="shrink-0">
                      <Badge tone="warn">Awaiting reply</Badge>
                    </div>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted sm:text-base">
                      {ev.pending.map((g) => (
                        <li key={g.id}>{g.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Plus-ones */}
      {summary.plusOnes.length > 0 && (
        <Card>
          <CardBody className="space-y-2 p-6 sm:p-7">
            <h3 className="font-serif text-2xl font-medium text-ink">Additional guests</h3>
            <ul className="space-y-1 text-sm text-ink sm:text-base">
              {summary.plusOnes.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Answers */}
      {hasAnswers && (
        <Card>
          <CardBody className="space-y-5 p-6 sm:p-7">
            <h3 className="font-serif text-2xl font-medium text-ink">Your answers</h3>

            <div className="divide-y divide-line">
              {summary.guestAnswers.map((ga) => (
                <div key={ga.guestId} className="space-y-2.5 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-medium text-ink">{ga.guestName}</p>
                    {ga.ageGroup === "child" && <Badge tone="neutral">Child</Badge>}
                    {ga.isPlusOne && <Badge tone="neutral">Plus-one</Badge>}
                  </div>
                  <dl className="space-y-2">
                    {ga.answers.map((a) => (
                      <div key={a.questionId} className="space-y-0.5 text-sm sm:text-base">
                        <dt className="text-ink-muted">{a.label}</dt>
                        <dd className="whitespace-pre-wrap text-ink">{a.displayValue}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}

              {summary.householdAnswers.length > 0 && (
                <div className="space-y-2.5 py-4 first:pt-0 last:pb-0">
                  {summary.guestAnswers.length > 0 && (
                    <p className="text-base font-medium text-ink">Household</p>
                  )}
                  <dl className="space-y-2">
                    {summary.householdAnswers.map((a) => (
                      <div key={a.questionId} className="space-y-0.5 text-sm sm:text-base">
                        <dt className="text-ink-muted">{a.label}</dt>
                        <dd className="whitespace-pre-wrap text-ink">{a.displayValue}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Note */}
      {summary.note && (
        <Card>
          <CardBody className="space-y-2 p-6 sm:p-7">
            <h3 className="font-serif text-2xl font-medium text-ink">Note to the couple</h3>
            <TextBlock text={summary.note} className="text-sm text-ink sm:text-base" />
          </CardBody>
        </Card>
      )}

      {/* Edit button or contact message */}
      <div className="pt-1">
        {canEdit && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-accent bg-surface px-6 text-base font-medium text-accent-strong transition-colors hover:bg-accent/5 sm:w-auto"
          >
            Change my RSVP
          </button>
        ) : (
          <p className="text-sm text-ink-muted">Contact the couple to make changes.</p>
        )}
      </div>
    </div>
  );
}
