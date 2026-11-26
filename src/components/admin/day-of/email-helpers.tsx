"use client";

import { useActionState } from "react";
import { emailAllHelpersAction, emailHelperAction } from "@/app/admin/day-of/helpers/actions";
import { ConfirmButton, FormMessage, SubmitButton } from "@/components/ui";

/** "Email them their jobs" for one helper, with the result (including why it failed). */
export function EmailHelperButton({ helperId }: { helperId: string }) {
  const [state, action] = useActionState(emailHelperAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={helperId} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…">
        Email them their jobs
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Emails every helper with an email address and a job. Asks first: it uses up the email allowance. */
export function EmailAllHelpersButton({ count }: { count: number }) {
  const [state, action] = useActionState(emailAllHelpersAction, null);
  return (
    <form action={action} className="space-y-2">
      <ConfirmButton
        variant="secondary"
        confirm={`Email ${count === 1 ? "1 helper" : `${count} helpers`} their jobs?`}
        detail={`Each helper with an email address and at least one job gets a link to their page. That's ${count} ${count === 1 ? "email" : "emails"} from your daily allowance.`}
        confirmLabel={count === 1 ? "Send 1 email" : `Send ${count} emails`}
        pendingLabel="Sending…"
      >
        Email everyone their jobs
      </ConfirmButton>
      <FormMessage state={state} />
    </form>
  );
}
