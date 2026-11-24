"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Checkbox,
  Field,
  FormMessage,
  Input,
  Notice,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { describeRsvpWindowStatus } from "@/lib/rsvp-admin/summary";
import { isValidIsoDate } from "@/lib/rsvp-admin/validation";

export function RsvpSettingsForm({
  action,
  initial,
  timeZone,
  nowMs,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: {
    rsvpOpen: boolean;
    rsvpDeadline: string | null;
    rsvpAllowEdits: boolean;
    rsvpClosedMessage: string | null;
  };
  timeZone: string;
  nowMs: number;
}) {
  const [state, formAction] = useActionState(action, null);
  const [rsvpOpen, setRsvpOpen] = useState(initial.rsvpOpen);
  const [rsvpDeadline, setRsvpDeadline] = useState(initial.rsvpDeadline ?? "");
  const [rsvpAllowEdits, setRsvpAllowEdits] = useState(initial.rsvpAllowEdits);
  const [rsvpClosedMessage, setRsvpClosedMessage] = useState(
    initial.rsvpClosedMessage ?? "",
  );

  const validDeadline =
    rsvpDeadline && isValidIsoDate(rsvpDeadline) ? rsvpDeadline : null;
  const status = describeRsvpWindowStatus(
    {
      timeZone,
      rsvpOpen,
      rsvpDeadline: validDeadline,
      rsvpAllowEdits,
    },
    nowMs,
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FormMessage state={state} />

      <Notice tone={status.open ? "good" : "warn"} title={status.headline}>
        {status.detail}
      </Notice>

      <Checkbox
        id="rsvpOpen"
        name="rsvpOpen"
        label="Accept RSVPs"
        hint="Turn this off to close RSVPs immediately, regardless of the deadline."
        checked={rsvpOpen}
        onChange={(e) => setRsvpOpen(e.target.checked)}
      />

      <Field
        label="RSVP deadline"
        htmlFor="rsvpDeadline"
        optional
        error={state?.errors?.rsvpDeadline}
        hint={`RSVPs close at 11:59 pm on this date (${timeZone} time). Leave blank for no deadline.`}
      >
        <div className="flex items-center gap-2">
          <Input
            id="rsvpDeadline"
            name="rsvpDeadline"
            type="date"
            value={rsvpDeadline}
            onChange={(e) => setRsvpDeadline(e.target.value)}
            invalid={!!state?.errors?.rsvpDeadline}
            className="max-w-xs"
          />
          {rsvpDeadline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRsvpDeadline("")}
            >
              Clear
            </Button>
          )}
        </div>
      </Field>

      <Checkbox
        id="rsvpAllowEdits"
        name="rsvpAllowEdits"
        label="Let guests change their RSVP until the deadline"
        hint="Guests who have already replied can update their attendance and answers while RSVPs are open."
        checked={rsvpAllowEdits}
        onChange={(e) => setRsvpAllowEdits(e.target.checked)}
      />

      <Field
        label="Message when RSVPs are closed"
        htmlFor="rsvpClosedMessage"
        optional
        error={state?.errors?.rsvpClosedMessage}
        hint="Shown on your RSVP page after RSVPs close. Leave blank to show “RSVPs are now closed.”"
      >
        <Textarea
          id="rsvpClosedMessage"
          name="rsvpClosedMessage"
          rows={4}
          value={rsvpClosedMessage}
          onChange={(e) => setRsvpClosedMessage(e.target.value)}
          placeholder="RSVPs are now closed. Please get in touch with us directly if your plans change."
          invalid={!!state?.errors?.rsvpClosedMessage}
        />
      </Field>

      <div className="pt-1">
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
