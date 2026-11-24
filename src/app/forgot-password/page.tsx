"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, null);
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your email and we'll send you a link to choose a new one."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form action={action} className="space-y-5">
        <FormMessage state={state} />
        <Field label="Email" htmlFor="email" error={state?.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required invalid={!!state?.errors?.email} />
        </Field>
        <SubmitButton className="w-full" pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
