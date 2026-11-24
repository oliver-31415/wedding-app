"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export function LoginForm({
  action,
  nextPath,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  nextPath: string | null;
}) {
  const [state, formAction] = useActionState(action, null);
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
      <FormMessage state={state} />
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
        label={
          <span className="flex items-center justify-between">
            Password
            <a href="/forgot-password" className="text-sm font-normal text-brand hover:underline">
              Forgot password?
            </a>
          </span>
        }
        htmlFor="password"
        error={state?.errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          invalid={!!state?.errors?.password}
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
