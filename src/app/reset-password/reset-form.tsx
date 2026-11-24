"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { resetPasswordAction } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password" hint="At least 10 characters." error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!state?.errors?.password} />
      </Field>
      <Field label="Type it again" htmlFor="confirm" error={state?.errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" invalid={!!state?.errors?.confirm} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
