"use client";

import { useActionState, useState } from "react";
import { saveEventAction } from "@/app/admin/schedule/actions";
import {
  AudiencePicker,
  Checkbox,
  Field,
  FormMessage,
  Input,
  LinkButton,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import type { Audience } from "@/db/schema";
import { splitWallTime } from "@/lib/pages";

export type EditableEvent = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  dressCode: string | null;
  description: string | null;
  audience: Audience;
  guestsOnly: boolean;
  rsvpEnabled: boolean;
};

export function EventForm({
  event,
  tags,
  timeZone,
}: {
  event?: EditableEvent;
  tags: { id: string; name: string }[];
  timeZone: string;
}) {
  const [state, action] = useActionState(saveEventAction, null);
  const start = splitWallTime(event?.startsAt);
  const end = splitWallTime(event?.endsAt);

  const [name, setName] = useState(event?.name ?? "");
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [venueName, setVenueName] = useState(event?.venueName ?? "");
  const [address, setAddress] = useState(event?.address ?? "");
  const [dressCode, setDressCode] = useState(event?.dressCode ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [rsvpEnabled, setRsvpEnabled] = useState(event ? event.rsvpEnabled : true);
  const [guestsOnly, setGuestsOnly] = useState(event?.guestsOnly ?? false);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <FormMessage state={state} />

      <Field label="Event name" htmlFor="event-name" error={state?.errors?.name}>
        <Input
          id="event-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ceremony, Reception, Welcome drinks"
          invalid={!!state?.errors?.name}
          required
        />
      </Field>

      <div className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="event-date" optional error={state?.errors?.date}>
            <Input
              id="event-date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              invalid={!!state?.errors?.date}
            />
          </Field>
          <Field
            label="Start time"
            htmlFor="event-start-time"
            optional
            error={state?.errors?.startTime}
          >
            <Input
              id="event-start-time"
              name="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              invalid={!!state?.errors?.startTime}
            />
          </Field>
          <Field
            label="End time"
            htmlFor="event-end-time"
            optional
            error={state?.errors?.endTime}
          >
            <Input
              id="event-end-time"
              name="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              invalid={!!state?.errors?.endTime}
            />
          </Field>
        </div>
        <p className="text-sm text-ink-muted">
          Times are in {timeZone}. Leave blank if the time is still to be announced.
        </p>
      </div>

      <Field label="Venue name" htmlFor="event-venue" optional>
        <Input
          id="event-venue"
          name="venueName"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="e.g. Centennial Vineyards"
        />
      </Field>

      <Field
        label="Address"
        htmlFor="event-address"
        optional
        hint="Guests get a Google Maps link when an address is set."
      >
        <Input
          id="event-address"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 252 Centennial Rd, Bowral NSW 2576"
        />
      </Field>

      <Field label="Dress code" htmlFor="event-dress-code" optional>
        <Input
          id="event-dress-code"
          name="dressCode"
          value={dressCode}
          onChange={(e) => setDressCode(e.target.value)}
          placeholder="e.g. Garden formal, Cocktail"
        />
      </Field>

      <Field
        label="Description"
        htmlFor="event-description"
        optional
        hint="Arrival notes, parking or anything guests should know. Blank lines make paragraphs."
      >
        <Textarea
          id="event-description"
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details for guests…"
        />
      </Field>

      <div className="space-y-2 rounded-lg border border-line bg-canvas p-4">
        <p className="text-sm font-medium text-ink">Who&rsquo;s invited</p>
        <p className="text-sm text-ink-muted">
          Controls both who sees this event on your schedule and who is asked to RSVP.
        </p>
        <div className="pt-1">
          <AudiencePicker
            name="audience"
            tags={tags}
            defaultValue={event?.audience}
            everyoneLabel="Everyone on the guest list"
            tagsLabel="Only guests with these tags"
            error={state?.errors?.audience}
          />
        </div>
        <div className="border-t border-line pt-3">
          <Checkbox
            name="guestsOnly"
            checked={guestsOnly}
            onChange={(e) => setGuestsOnly(e.target.checked)}
            label="Only show this event to invited guests"
            hint="Visitors have to find their invitation (or use their personal link) before they can see this event’s name, time or place. Events limited to tags are always hidden this way."
          />
        </div>
      </div>

      <Checkbox
        name="rsvpEnabled"
        checked={rsvpEnabled}
        onChange={(e) => setRsvpEnabled(e.target.checked)}
        label="Ask guests to RSVP to this event"
        hint="Uncheck for drop-in events where you don’t need a headcount."
      />

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">
          {event ? "Save event" : "Add event"}
        </SubmitButton>
        <LinkButton href="/admin/schedule" variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
