"use client";

import { useActionState } from "react";
import { unlockSiteAction } from "@/app/w/[slug]/unlock/actions";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";

export function UnlockForm({
  weddingSlug,
  nextPath,
}: {
  weddingSlug: string;
  nextPath: string;
}) {
  const [state, action] = useActionState(unlockSiteAction, null);

  return (
    <form action={action} className="mt-6 space-y-4 text-left">
      <input type="hidden" name="slug" value={weddingSlug} />
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />
      <Field label="Site password" htmlFor="site-password" error={state?.errors?.password}>
        <Input
          id="site-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Enter password"
          invalid={!!state?.errors?.password}
          required
        />
      </Field>
      <SubmitButton
        pendingLabel="Checking…"
        className="w-full"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        Continue
      </SubmitButton>
    </form>
  );
}
