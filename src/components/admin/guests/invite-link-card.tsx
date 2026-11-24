"use client";

import { Card, CardBody, CardHeader, ConfirmButton, CopyButton } from "@/components/ui";
import { resetInviteLinkAction } from "@/app/admin/guests/actions";

export function InviteLinkCard({
  householdId,
  inviteUrl,
  contactUrl,
}: {
  householdId: string;
  inviteUrl: string;
  /** Their personal contact details form: replies update this household straight away. */
  contactUrl: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Personal links"
        description="Only this household should get these: they open without typing a name."
      />
      <CardBody className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">RSVP</p>
          <div className="rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-xs break-all text-ink select-all">
            {inviteUrl}
          </div>
          <CopyButton text={inviteUrl} label="Copy RSVP link" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Contact details</p>
          <p className="text-sm text-ink-muted">
            They can check and fill in their emails, mobiles and postal address. Their answers update this household
            straight away.
          </p>
          <div className="rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-xs break-all text-ink select-all">
            {contactUrl}
          </div>
          <CopyButton text={contactUrl} label="Copy contact details link" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <form action={resetInviteLinkAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <ConfirmButton
              variant="secondary"
              size="sm"
              confirm="Reset this household’s links? The old RSVP and contact details links will stop working straight away."
            >
              Reset links
            </ConfirmButton>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
