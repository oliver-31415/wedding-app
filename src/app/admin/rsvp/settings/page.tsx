import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { RsvpSubNav } from "@/components/admin/rsvp/rsvp-sub-nav";
import { RsvpSettingsForm } from "@/components/admin/rsvp/settings-form";
import { Card, CardBody, Notice, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { currentTimestamp } from "@/lib/rsvp-admin/summary";
import { saveRsvpSettings } from "./actions";

export default async function RsvpSettingsPage() {
  const { wedding } = await requireHost();

  const [rsvpPage] = await db
    .select({ id: schema.pages.id, visibility: schema.pages.visibility })
    .from(schema.pages)
    .where(
      and(
        eq(schema.pages.weddingId, wedding.id),
        eq(schema.pages.type, "rsvp"),
      ),
    )
    .limit(1);

  const nowMs = currentTimestamp();

  return (
    <div>
      <PageHeader
        title="RSVP settings"
        description="Control when guests can reply, whether they can edit their answers, and what they see after RSVPs close."
      />

      <RsvpSubNav current="/admin/rsvp/settings" />

      <div className="space-y-6">
        {!rsvpPage && (
          <Notice tone="warn" title="Your website doesn't have an RSVP page yet">
            <Link
              href="/admin/website"
              className="font-medium underline underline-offset-2"
            >
              Add an RSVP page so guests can reply
            </Link>
            .
          </Notice>
        )}

        <Card>
          <CardBody>
            <RsvpSettingsForm
              action={saveRsvpSettings}
              initial={{
                rsvpOpen: wedding.rsvpOpen,
                rsvpDeadline: wedding.rsvpDeadline,
                rsvpAllowEdits: wedding.rsvpAllowEdits,
                rsvpClosedMessage: wedding.rsvpClosedMessage,
              }}
              timeZone={wedding.timeZone}
              nowMs={nowMs}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
