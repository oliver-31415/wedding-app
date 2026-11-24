"use client";

import { useState } from "react";
import type { HouseholdRsvpState, SnapGuest, SnapHousehold, SnapQuestion } from "@/lib/rsvp/model";
import type { EventDetail, GuestFormState } from "@/lib/rsvp-guest/form-model";
import type { ConfirmationSummary } from "@/lib/rsvp-guest/summary";
import { RsvpForm } from "./rsvp-form";
import { RsvpSummary } from "./rsvp-summary";

export function RsvpFlow({
  weddingId,
  slug,
  household,
  mainGuests,
  events,
  questions,
  rsvpState,
  initialSummary,
  initialFormState,
  canEdit,
  deadline,
  notYouRedirectTo = null,
}: {
  weddingId: string;
  slug: string;
  household: SnapHousehold;
  mainGuests: SnapGuest[];
  events: EventDetail[];
  questions: SnapQuestion[];
  rsvpState: HouseholdRsvpState;
  initialSummary: ConfirmationSummary;
  initialFormState: GuestFormState;
  canEdit: boolean;
  deadline: string | null;
  notYouRedirectTo?: string | null;
}) {
  // A partly-answered household always lands in the form: with edits off, it
  // can still answer what's new (e.g. an event added later), with earlier answers locked.
  const startInForm = rsvpState === "not_started" || rsvpState === "partial";
  const [mode, setMode] = useState<"form" | "summary">(startInForm ? "form" : "summary");
  const [summary, setSummary] = useState<ConfirmationSummary>(initialSummary);
  const [formState, setFormState] = useState<GuestFormState>(initialFormState);
  const [hasExistingResponse, setHasExistingResponse] = useState<boolean>(
    rsvpState === "complete" || rsvpState === "partial",
  );
  const [justSubmitted, setJustSubmitted] = useState<"first" | "update" | null>(null);

  if (mode === "summary") {
    return (
      <RsvpSummary
        weddingId={weddingId}
        slug={slug}
        summary={summary}
        canEdit={canEdit}
        justSubmitted={justSubmitted}
        notYouRedirectTo={notYouRedirectTo}
        onEdit={
          canEdit
            ? () => {
                setJustSubmitted(null);
                setMode("form");
              }
            : undefined
        }
      />
    );
  }

  return (
    <RsvpForm
      weddingId={weddingId}
      slug={slug}
      household={household}
      mainGuests={mainGuests}
      events={events}
      questions={questions}
      initialState={formState}
      isEditing={hasExistingResponse}
      partialReminder={rsvpState === "partial" && !justSubmitted}
      lockAnswered={!canEdit && hasExistingResponse}
      deadline={deadline}
      notYouRedirectTo={notYouRedirectTo}
      onSaved={(res) => {
        setSummary(res.summary);
        setFormState(res.initialFormState);
        setHasExistingResponse(true);
        setJustSubmitted(res.firstResponse ? "first" : "update");
        setMode("summary");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      onCancelEdit={
        hasExistingResponse && rsvpState === "complete"
          ? () => {
              setMode("summary");
            }
          : undefined
      }
    />
  );
}
