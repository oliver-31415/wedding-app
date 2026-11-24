"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { MIN_PASSWORD_LENGTH } from "./validation";

export function SignupForm({
  action,
  nextPath,
  inviteToken = null,
  lockedEmail = null,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  nextPath: string | null;
  inviteToken?: string | null;
  /** When the invite names an email address, pre-fill it. */
  lockedEmail?: string | null;
}) {
  const [state, formAction] = useActionState(action, null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(lockedEmail ?? "");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
      {inviteToken && <input type="hidden" name="invite" value={inviteToken} />}
      <FormMessage state={state} />
      <Field label="Your name" htmlFor="name" error={state?.errors?.name}>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          invalid={!!state?.errors?.name}
          required
        />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!state?.errors?.email}
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={state?.errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          invalid={!!state?.errors?.password}
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
