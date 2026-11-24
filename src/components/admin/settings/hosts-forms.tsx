"use client";

import { useActionState } from "react";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, Notice, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { CopyButton } from "@/components/ui";

export type InviteCohostState =
  | (NonNullable<ActionState> & {
      inviteUrl?: string;
      invitedEmail?: string;
      submittedEmail?: string;
    })
  | null;

export function InviteCohostCard({
  action,
}: {
  action: (prev: InviteCohostState, formData: FormData) => Promise<InviteCohostState>;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <Card>
      <CardHeader
        title="Invite a co-host"
        description="Co-hosts can edit your website, manage guests and RSVPs, send messages and update your gift list. Only the owner can change hosts and the web address."
      />
      <CardBody className="max-w-2xl space-y-5">
        <form action={formAction} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <Field
            label="Co-host's email"
            htmlFor="invite-email"
            hint="We'll email them an invitation link that expires in 7 days, and you can also copy it below."
            error={state?.errors?.email}
          >
            <Input
              key={state?.inviteUrl ?? "invite-email"}
              id="invite-email"
              name="email"
              type="email"
              placeholder="partner@example.com"
              defaultValue={state && !state.ok ? (state.submittedEmail ?? "") : ""}
              invalid={!!state?.errors?.email}
              required
            />
          </Field>
          <SubmitButton pendingLabel="Sending invite…">Send invite</SubmitButton>
        </form>

        {state?.ok && state.inviteUrl && (
          <Notice tone="info" title={`Invite link for ${state.invitedEmail}`}>
            <p className="mb-2">
              Copy and share this link directly if you like — for security it&apos;s only shown once.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink">
              <code className="break-all font-mono text-xs">{state.inviteUrl}</code>
              <CopyButton text={state.inviteUrl} label="Copy invite link" />
            </div>
          </Notice>
        )}
      </CardBody>
    </Card>
  );
}
