"use client";

import { Card, CardBody, CardHeader, ConfirmButton, CopyButton } from "@/components/ui";
import { resetInviteLinkAction } from "@/app/admin/guests/actions";

export function InviteLinkCard({ householdId, inviteUrl }: { householdId: string; inviteUrl: string }) {
  return (
    <Card>
      <CardHeader
        title="Personal RSVP link"
        description="Send this link directly to let this household RSVP without typing their name."
      />
      <CardBody className="space-y-3">
        <div className="rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-xs break-all text-ink select-all">
          {inviteUrl}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={inviteUrl} label="Copy link" />
          <form action={resetInviteLinkAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <ConfirmButton
              variant="secondary"
              size="sm"
              confirm="Reset this household’s RSVP link? The old link will stop working straight away."
            >
              Reset link
            </ConfirmButton>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
