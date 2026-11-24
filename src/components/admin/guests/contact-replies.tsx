"use client";

import { useActionState, useId, useState } from "react";
import { applyContactReplyAction, dismissContactReplyAction } from "@/app/admin/guests/contacts/actions";
import { Card, CardBody, CardHeader, ConfirmButton, EmptyState, Field, FormMessage, Select, SubmitButton } from "@/components/ui";
import type { ContactAddress, ContactPerson } from "@/db/schema";
import { addressLines, type HouseholdMember, planContactApply, planIsEmpty } from "@/lib/contacts";

export type ReplyHousehold = { id: string; label: string; members: HouseholdMember[]; address: ContactAddress };
export type Reply = {
  id: string;
  people: ContactPerson[];
  address: ContactAddress;
  note: string | null;
  received: string;
  /** Household whose guest list has someone with a matching name. */
  suggestion: string | null;
};

const Change = ({ label, from, to }: { label: string; from: string | null; to: string }) => (
  <li>
    {label}: {from ? <span className="text-ink-faint line-through">{from}</span> : <span className="text-ink-faint">none</span>}{" "}
    → <span className="font-medium text-ink">{to}</span>
  </li>
);

function ReplyCard({ reply, households }: { reply: Reply; households: ReplyHousehold[] }) {
  const id = useId();
  const [state, action] = useActionState(applyContactReplyAction, null);
  const [target, setTarget] = useState(reply.suggestion ?? "");
  const household = households.find((h) => h.id === target);
  const plan = household ? planContactApply(reply, household.members, household.address) : null;
  const lines = addressLines(reply.address);

  return (
    <li className="space-y-4 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-sm">
          {reply.people.map((p, i) => (
            <p key={i} className="text-ink">
              <span className="font-medium">
                {p.firstName} {p.lastName}
              </span>
              {[p.email, p.phone].filter(Boolean).length > 0 && (
                <span className="text-ink-muted"> · {[p.email, p.phone].filter(Boolean).join(" · ")}</span>
              )}
            </p>
          ))}
          {lines.length > 0 && <p className="text-ink-muted">{lines.join(", ")}</p>}
          {reply.note && <p className="text-ink-muted italic">&ldquo;{reply.note}&rdquo;</p>}
          <p className="text-xs text-ink-faint">Received {reply.received}</p>
        </div>
      </div>

      <form action={action} className="space-y-3 rounded-lg border border-line bg-sunken/40 p-4">
        <input type="hidden" name="id" value={reply.id} />
        <FormMessage state={state?.ok ? null : state} />
        <Field
          label="Whose details are these?"
          htmlFor={`${id}-target`}
          hint={reply.suggestion && target === reply.suggestion ? "Suggested because the names match." : undefined}
          error={state?.errors?.target}
        >
          <Select id={`${id}-target`} name="target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a household…</option>
            <option value="new">Add as a new household</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </Select>
        </Field>

        {target === "new" && (
          <p className="text-sm text-ink-muted">
            Adds {reply.people.map((p) => p.firstName).join(" and ")} to your guest list as a new household.
          </p>
        )}
        {plan && (
          <div className="text-sm text-ink-muted">
            {planIsEmpty(plan) ? (
              <p>Nothing would change: {household!.label} already has these details.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {plan.updates.map((u) => (
                  <li key={u.guestId}>
                    <span className="font-medium text-ink">{u.name}</span>
                    <ul className="list-[circle] pl-5">
                      {u.email && <Change label="Email" from={u.email.from} to={u.email.to} />}
                      {u.phone && <Change label="Mobile" from={u.phone.from} to={u.phone.to} />}
                    </ul>
                  </li>
                ))}
                {plan.additions.map((p, i) => (
                  <li key={`add-${i}`}>
                    Adds <span className="font-medium text-ink">{p.firstName} {p.lastName}</span> to {household!.label}
                  </li>
                ))}
                {plan.address && (
                  <li>
                    Postal address → <span className="font-medium text-ink">{plan.address.to.join(", ")}</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <SubmitButton size="sm" pendingLabel="Applying…" disabled={!target}>
            {target === "new" ? "Add to guest list" : "Apply"}
          </SubmitButton>
        </div>
      </form>
      <form action={dismissContactReplyAction}>
        <input type="hidden" name="id" value={reply.id} />
        <ConfirmButton variant="ghost" confirm="Dismiss this reply?" detail="Nothing on your guest list changes.">
          Dismiss
        </ConfirmButton>
      </form>
    </li>
  );
}

/** Replies through the shared link, waiting for the couple to say who they belong to. */
export function ContactReplies({ replies, households }: { replies: Reply[]; households: ReplyHousehold[] }) {
  return (
    <Card>
      <CardHeader
        title="Replies to review"
        description={
          replies.length
            ? "Check each one before it changes your guest list: anyone with the link can fill in the form."
            : undefined
        }
      />
      {replies.length === 0 ? (
        <CardBody>
          <EmptyState title="Nothing to review" body="Replies through your shared link will show up here." />
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {replies.map((r) => (
            <ReplyCard key={r.id} reply={r} households={households} />
          ))}
        </ul>
      )}
    </Card>
  );
}
