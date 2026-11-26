"use client";

import { useState } from "react";
import { Field, Input, Notice, Textarea } from "@/components/ui";
import type { NameCheckActionState } from "./actions";

/**
 * "Ask Alex & Sam to check": shown when a typed name finds nothing (or the
 * guest says none of the offered names is them). The typed name comes along.
 * The action state lives in `InvitationLookup`, which shows the thanks.
 */
export function NameCheckRequest({
  weddingId,
  firstName,
  lastName,
  couple,
  state,
  action,
  pending,
}: {
  weddingId: string;
  firstName: string;
  lastName: string;
  couple: string;
  state: NameCheckActionState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  // Controlled, so an error (a typo in the email, the rate limit) doesn't wipe what they wrote.
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const errors = state?.kind === "error" ? state.errors : undefined;
  const hasName = !!firstName.trim() && !!lastName.trim();
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h3 className="font-serif text-xl font-medium text-ink">Ask {couple} to check</h3>
        <p className="text-sm text-ink-muted">
          {hasName ? (
            <>
              We&apos;ll send them the name{" "}
              <span className="font-medium text-ink">
                {firstName.trim()} {lastName.trim()}
              </span>
              .{" "}
            </>
          ) : (
            "Enter your first and last name above. "
          )}
          If you&apos;re on their list, they&apos;ll email you your invitation link.
        </p>
      </div>
      <input type="hidden" name="weddingId" value={weddingId} />
      <input type="hidden" name="firstName" value={firstName} />
      <input type="hidden" name="lastName" value={lastName} />

      {state?.kind === "error" && (!errors || errors.name) && <Notice tone="bad">{state.message}</Notice>}

      <Field label="Your email" htmlFor="name-check-email" error={errors?.email}>
        <Input
          id="name-check-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!errors?.email}
          className="h-11 text-base focus:border-accent"
        />
      </Field>
      <Field label="Anything we should know?" htmlFor="name-check-note" optional error={errors?.note}>
        <Textarea
          id="name-check-note"
          name="note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example, your invitation might use your maiden name"
          invalid={!!errors?.note}
          className="text-base focus:border-accent"
        />
      </Field>
      <button
        type="submit"
        disabled={pending || !hasName}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-accent px-6 py-2 text-base font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Sending…" : `Ask ${couple} to check`}
      </button>
    </form>
  );
}
