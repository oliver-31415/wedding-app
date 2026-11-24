import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { HostRsvpEditor } from "@/components/admin/guests/host-rsvp-editor";
import { HouseholdForm } from "@/components/admin/guests/household-form";
import { InviteLinkCard } from "@/components/admin/guests/invite-link-card";
import { BackLink, Badge, Card, CardBody, CardHeader, PageHeader, TextBlock } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatRelative } from "@/lib/dates";
import { appUrl } from "@/lib/email-layout";
import { HOUSEHOLD_STATE_META } from "@/lib/guests/status";
import { householdLabel, householdRsvpState, responsesMap } from "@/lib/rsvp/model";
import { householdSlice, loadSnapshot } from "@/lib/snapshot";
import { sitePath } from "@/lib/site-paths";

export default async function HouseholdPage({ params }: PageProps<"/admin/guests/[householdId]">) {
  const { householdId } = await params;
  const { wedding, siteBase } = await requireHost();

  const [householdRow] = await db
    .select()
    .from(schema.households)
    .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, wedding.id)))
    .limit(1);

  if (!householdRow) notFound();

  const [snapshot, guestPhones, allTags, activity] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select({ id: schema.guests.id, phone: schema.guests.phone })
      .from(schema.guests)
      .where(and(eq(schema.guests.householdId, householdId), eq(schema.guests.weddingId, wedding.id))),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
    db
      .select()
      .from(schema.rsvpActivity)
      .where(and(eq(schema.rsvpActivity.householdId, householdId), eq(schema.rsvpActivity.weddingId, wedding.id)))
      .orderBy(desc(schema.rsvpActivity.createdAt)),
  ]);

  const slice = householdSlice(snapshot, householdId);
  if (!slice) notFound();

  const phoneById = new Map(guestPhones.map((g) => [g.id, g.phone]));
  const label = householdLabel(householdRow, slice.guests);
  const rsvpState = householdRsvpState(slice.guests, snapshot.events, responsesMap(slice.responses));
  const stateMeta = HOUSEHOLD_STATE_META[rsvpState];
  const inviteUrl = `${appUrl()}${sitePath(siteBase, `i/${householdRow.inviteToken}`)}`;

  const mainMembers = slice.guests
    .filter((g) => !g.isPlusOne)
    .map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email ?? "",
      phone: phoneById.get(g.id) ?? "",
      isChild: g.ageGroup === "child",
      tagIds: g.tagIds,
    }));

  const plusOnes = slice.guests
    .filter((g) => g.isPlusOne)
    .map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <BackLink href="/admin/guests">Guest list</BackLink>
        }
        title={label}
        description={
          householdRow.envelopeName
            ? `${slice.guests.length} ${slice.guests.length === 1 ? "guest" : "guests"} in this household`
            : undefined
        }
        actions={<Badge tone={stateMeta.tone}>{stateMeta.label}</Badge>}
      />

      <InviteLinkCard householdId={householdRow.id} inviteUrl={inviteUrl} />

      <HostRsvpEditor
        householdId={householdRow.id}
        guests={slice.guests}
        events={snapshot.events}
        questions={snapshot.questions}
        initialResponses={slice.responses}
        initialAnswers={slice.answers}
      />

      <HouseholdForm
        mode="edit"
        householdId={householdRow.id}
        initialHousehold={{
          envelopeName: householdRow.envelopeName,
          plusOnesAllowed: householdRow.plusOnesAllowed,
          addressLine1: householdRow.addressLine1,
          addressLine2: householdRow.addressLine2,
          city: householdRow.city,
          region: householdRow.region,
          postcode: householdRow.postcode,
          country: householdRow.country,
          notes: householdRow.notes,
        }}
        initialMembers={mainMembers}
        plusOnes={plusOnes}
        tags={allTags}
      />

      <Card>
        <CardHeader title="Activity" description="Latest RSVP submissions and updates for this household." />
        <CardBody>
          {activity.length === 0 ? (
            <p className="text-sm text-ink-muted">No RSVP activity yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((entry) => {
                const actionLabel =
                  entry.source === "guest"
                    ? entry.kind === "first"
                      ? "Submitted RSVP"
                      : "Updated RSVP"
                    : entry.kind === "first"
                      ? "Recorded RSVP"
                      : "Updated RSVP";
                return (
                  <li key={entry.id} className="space-y-2 py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{actionLabel}</span>
                        <Badge tone={entry.source === "guest" ? "info" : "neutral"}>
                          {entry.source === "guest" ? "Guest" : "Host"}
                        </Badge>
                      </div>
                      <time
                        dateTime={entry.createdAt.toISOString()}
                        title={entry.createdAt.toLocaleString("en-AU", { timeZone: wedding.timeZone })}
                        className="text-xs text-ink-muted"
                      >
                        {formatRelative(entry.createdAt.getTime())}
                      </time>
                    </div>
                    {entry.note && (
                      <div className="rounded-lg bg-sunken px-3.5 py-2.5 text-sm text-ink">
                        <TextBlock text={entry.note} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
