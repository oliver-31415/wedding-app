import { and, asc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { GuestListClient } from "@/components/admin/guests/guest-list-client";
import { GUESTS_SUBNAV } from "@/components/admin/guests/nav";
import { LinkButton, Notice, PageHeader, SubNav, buttonClass } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import type { GuestListHousehold } from "@/lib/guests/filter";
import { formatGuestSummary } from "@/lib/guests/status";
import {
  guestEventStatus,
  householdLabel,
  householdRsvpState,
  plusOnesRemaining,
  responsesMap,
  sortByPosition,
} from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import { computeStats } from "@/lib/stats";

export default async function GuestsPage() {
  const { wedding } = await requireHost();

  const [snapshot, allTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const stats = computeStats(snapshot);
  const respMap = responsesMap(snapshot.responses);
  const rsvpEvents = sortByPosition(snapshot.events.filter((e) => e.rsvpEnabled));

  const guestsByHousehold = new Map<string, typeof snapshot.guests>();
  for (const g of snapshot.guests) {
    const list = guestsByHousehold.get(g.householdId);
    if (list) list.push(g);
    else guestsByHousehold.set(g.householdId, [g]);
  }

  const households: GuestListHousehold[] = snapshot.households
    .map((h) => {
      const members = guestsByHousehold.get(h.id) ?? [];
      return {
        id: h.id,
        label: householdLabel(h, members),
        plusOnesAllowed: h.plusOnesAllowed,
        plusOnesRemaining: plusOnesRemaining(h, members),
        rsvpState: householdRsvpState(members, snapshot.events, respMap),
        members: members.map((m) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          ageGroup: m.ageGroup,
          isPlusOne: m.isPlusOne,
          tagIds: m.tagIds,
          eventStatuses: rsvpEvents
            .map((ev) => ({
              eventId: ev.id,
              eventName: ev.name,
              status: guestEventStatus(m, ev, members, respMap),
            }))
            .filter((ev) => ev.status !== "not_invited"),
        })),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "en-AU"));

  const [{ pendingReplies }] = await db
    .select({ pendingReplies: sql<number>`count(*)` })
    .from(schema.contactSubmissions)
    .where(and(eq(schema.contactSubmissions.weddingId, wedding.id), eq(schema.contactSubmissions.status, "pending")));

  return (
    <div>
      <PageHeader
        title="Guests"
        description={formatGuestSummary(stats)}
        actions={
          <>
            <a href="/admin/guests/export.csv" className={buttonClass("secondary")}>
              Export CSV
            </a>
            <LinkButton href="/admin/guests/import" variant="secondary">
              Import
            </LinkButton>
            <LinkButton href="/admin/guests/new" variant="primary">
              Add household
            </LinkButton>
          </>
        }
      />
      <SubNav items={GUESTS_SUBNAV} current="/admin/guests" />
      {pendingReplies > 0 && (
        <div className="mb-4">
          <Notice tone="info" title={`${pendingReplies} ${pendingReplies === 1 ? "person has" : "people have"} sent contact details`}>
            <Link href="/admin/guests/contacts" className="font-medium underline">
              Review and add them to your guest list
            </Link>
          </Notice>
        </div>
      )}
      <GuestListClient households={households} tags={allTags} hasRsvpEvents={rsvpEvents.length > 0} />
    </div>
  );
}
