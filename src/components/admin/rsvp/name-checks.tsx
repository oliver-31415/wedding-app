"use client";

import { useActionState, useId, useState } from "react";
import { resolveNameCheckAction, type NameCheckResult } from "@/app/admin/rsvp/name-checks/actions";
import {
  Badge,
  Card,
  CardHeader,
  Checkbox,
  ConfirmButton,
  CopyButton,
  EmptyState,
  Field,
  HouseholdBadge,
  Notice,
  Select,
  SubmitButton,
} from "@/components/ui";
import type { MatchTier } from "@/lib/rsvp/lookup";
import type { HouseholdRsvpState } from "@/lib/rsvp/model";

export type NameCheckGuest = {
  id: string;
  name: string;
  firstName: string;
  email: string | null;
  householdId: string;
  householdLabel: string;
  householdState: HouseholdRsvpState;
  invitedTo: string[];
  notInvitedTo: string[];
};

export type NameCheckHousehold = { id: string; label: string; guestIds: string[] };

export type PendingNameCheck = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  note: string | null;
  sent: string;
  suggestions: { guestId: string; reason: string; tier: MatchTier }[];
};

/** Pending name checks. One action state for the list, so the result stays after the card goes. */
export function NameChecks({
  requests,
  guests,
  households,
}: {
  requests: PendingNameCheck[];
  guests: Record<string, NameCheckGuest>;
  households: NameCheckHousehold[];
}) {
  const [state, action] = useActionState<NameCheckResult, FormData>(resolveNameCheckAction, null);
  return (
    <div className="space-y-4">
      {state && (
        <Notice tone={state.ok ? "good" : state.link ? "warn" : "bad"}>
          <p>{state.message}</p>
          {state.link && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded bg-surface px-2 py-1 text-xs break-all text-ink">{state.link}</code>
              <CopyButton text={state.link} label="Copy their link" />
            </div>
          )}
        </Notice>
      )}
      {requests.length === 0 ? (
        <EmptyState
          title="No names to check"
          body="When a guest can't find their invitation (say they spell their name differently, or use a married name), they can ask you to check. Their requests show up here, with the people on your list they might be. Once you match them, we email them their invitation link and recognise that spelling next time."
        />
      ) : (
        requests.map((r) => <RequestCard key={r.id} request={r} guests={guests} households={households} action={action} />)
      )}
    </div>
  );
}

const TIER_BADGE: Record<MatchTier, { label: string; tone: "good" | "info" | "neutral" }> = {
  exact: { label: "Same name", tone: "good" },
  confident: { label: "Close match", tone: "info" },
  unsure: { label: "Possible match", tone: "neutral" },
};

function Invitation({ guest }: { guest: NameCheckGuest }) {
  return (
    <div className="space-y-0.5 text-sm text-ink-muted">
      <p>
        {guest.invitedTo.length > 0 ? (
          <>
            Invited to: <span className="font-medium text-ink">{guest.invitedTo.join(", ")}</span>
          </>
        ) : (
          "Not invited to any events yet"
        )}
      </p>
      {guest.invitedTo.length > 0 && guest.notInvitedTo.length > 0 && <p>Not invited to: {guest.notInvitedTo.join(", ")}</p>}
    </div>
  );
}

function SaveEmail({ guest, email }: { guest: NameCheckGuest; email: string }) {
  if (guest.email?.toLowerCase() === email.toLowerCase()) return null;
  return (
    <Checkbox
      key={guest.id}
      name="saveEmail"
      defaultChecked={!guest.email}
      label={guest.email ? `Replace their email (${guest.email}) with ${email}` : `Save ${email} as their email`}
    />
  );
}

function RequestCard({
  request,
  guests,
  households,
  action,
}: {
  request: PendingNameCheck;
  guests: Record<string, NameCheckGuest>;
  households: NameCheckHousehold[];
  action: (formData: FormData) => void;
}) {
  const id = useId();
  const typed = `${request.firstName} ${request.lastName}`;
  const suggestions = request.suggestions.filter((s) => guests[s.guestId]);
  const [other, setOther] = useState("");
  const otherGuest = other ? guests[other] : null;

  return (
    <Card>
      <CardHeader
        title={typed}
        description={
          <>
            <span className="break-words">{request.email}</span> · Sent {request.sent}
          </>
        }
      />
      <div className="space-y-4 px-5 py-4">
        {request.note && <p className="text-sm text-ink-muted italic">&ldquo;{request.note}&rdquo;</p>}
        <p className="text-sm text-ink-muted">
          If you choose someone, we&apos;ll email {request.email} their household&apos;s invitation link, so only accept
          if you&apos;re sure it&apos;s them.
        </p>

        {suggestions.length > 0 ? (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const g = guests[s.guestId];
              const tier = TIER_BADGE[s.tier];
              return (
                <li key={g.id} className="rounded-lg border border-line p-4">
                  <form action={action} className="space-y-3">
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="intent" value="accept" />
                    <input type="hidden" name="guestId" value={g.id} />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium text-ink">{g.name}</p>
                        <p className="text-sm text-ink">{s.reason}</p>
                        {g.householdLabel !== g.name && (
                          <p className="text-sm text-ink-muted">Household: {g.householdLabel}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={tier.tone}>{tier.label}</Badge>
                        <HouseholdBadge state={g.householdState} />
                      </div>
                    </div>
                    <Invitation guest={g} />
                    <SaveEmail guest={g} email={request.email} />
                    <SubmitButton size="sm" pendingLabel="Saving…" className="h-auto min-h-8 py-1.5 whitespace-normal">
                      Yes, that&apos;s {g.name}
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No one on your guest list has a similar name.</p>
        )}

        <details className="group rounded-lg border border-line bg-sunken/40" open={suggestions.length === 0}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">Someone else…</summary>
          <form action={action} className="space-y-3 px-4 pb-4">
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="intent" value="accept" />
            <Field label={`Who is ${typed}?`} htmlFor={`${id}-guest`}>
              <Select id={`${id}-guest`} name="guestId" value={other} onChange={(e) => setOther(e.target.value)}>
                <option value="">Choose a guest…</option>
                {households.map((h) => (
                  <optgroup key={h.id} label={h.label}>
                    {h.guestIds.map((gid) => (
                      <option key={gid} value={gid}>
                        {guests[gid].name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            {otherGuest && (
              <>
                <p className="text-sm text-ink-muted">Household: {otherGuest.householdLabel}</p>
                <Invitation guest={otherGuest} />
                <SaveEmail guest={otherGuest} email={request.email} />
              </>
            )}
            <SubmitButton size="sm" pendingLabel="Saving…" disabled={!otherGuest} className="h-auto min-h-8 py-1.5 whitespace-normal">
              {otherGuest ? `Yes, that's ${otherGuest.name}` : "Choose a guest"}
            </SubmitButton>
          </form>
        </details>

        <form action={action}>
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="intent" value="dismiss" />
          <ConfirmButton
            variant="secondary"
            confirm={`Dismiss ${typed}?`}
            detail="They won't be emailed. If they turn out to be on your list, you can copy their personal link from their household's page in your guest list."
            confirmLabel="Dismiss"
          >
            Not on our list
          </ConfirmButton>
        </form>
      </div>
    </Card>
  );
}
