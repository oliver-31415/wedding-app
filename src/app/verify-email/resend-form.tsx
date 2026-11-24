"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { resendVerificationAction } from "./actions";

export function ResendForm({ next }: { next: string | null }) {
  const [state, action] = useActionState(resendVerificationAction, null);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full" pendingLabel="Sending…">
        Send the link again
      </SubmitButton>
    </form>
  );
}
