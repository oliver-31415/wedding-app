"use client";

import { useActionState } from "react";
import { CopyButton, Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import type { InviteState } from "@/app/site-admin/actions";

export function InviteForm({ action }: { action: (prev: InviteState, formData: FormData) => Promise<InviteState> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <FormMessage state={state} />
      {state?.link && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2">
          <code className="min-w-0 flex-1 text-xs break-all text-ink">{state.link}</code>
          <CopyButton text={state.link} label="Copy link" />
        </div>
      )}
      <Field
        label="Their email"
        htmlFor="email"
        optional
        hint="If you add it, we email them the link and only that address can use it."
        error={state?.errors?.email}
      >
        <Input id="email" name="email" type="email" placeholder="name@example.com" invalid={!!state?.errors?.email} />
      </Field>
      <Field label="Note to yourself" htmlFor="note" optional hint="e.g. “Sam & Lee — their wedding in May”." error={state?.errors?.note}>
        <Input id="note" name="note" invalid={!!state?.errors?.note} />
      </Field>
      <SubmitButton pendingLabel="Creating…">Create invite link</SubmitButton>
    </form>
  );
}
