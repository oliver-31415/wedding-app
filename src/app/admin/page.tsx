import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import {
  firstName,
  formatWeddingDateHeader,
  getSetupChecklist,
} from "@/components/admin/dashboard/helpers";
import {
  EventStatsSection,
  GiftSummaryCard,
  RecentActivityCard,
  SetupChecklistCard,
  type ActivityItem,
} from "@/components/admin/dashboard/sections";
import { AttendingTile, AwaitingTile, ResponseRateTile } from "@/components/admin/rsvp-stats";
import { PageHeader, StatGrid, StatTile } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { computeGiftSummary } from "@/lib/gifts";
import { loadGiftData } from "@/lib/gifts-data";
import { householdLabel, type SnapGuest } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import { computeStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { user, wedding } = await requireHost();

  const [snapshot, giftData, weddingPages, activityRows] = await Promise.all([
    loadSnapshot(wedding.id),
    loadGiftData(wedding.id),
    db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.weddingId, wedding.id))
      .limit(1),
    db
      .select()
      .from(schema.rsvpActivity)
      .where(eq(schema.rsvpActivity.weddingId, wedding.id))
      .orderBy(desc(schema.rsvpActivity.createdAt))
      .limit(6),
  ]);

  const stats = computeStats(snapshot);
  const giftSummary = computeGiftSummary(giftData);

  const checklist = getSetupChecklist({
    hasPages: weddingPages.length > 0,
    hasEvents: snapshot.events.length > 0,
    hasGuests: snapshot.guests.length > 0,
    hasRsvpDeadline: wedding.rsvpDeadline !== null,
    isPublished: wedding.published,
  });

  const householdsById = new Map(snapshot.households.map((h) => [h.id, h]));
  const guestsByHousehold = new Map<string, SnapGuest[]>();
  for (const g of snapshot.guests) {
    const list = guestsByHousehold.get(g.householdId);
    if (list) list.push(g);
    else guestsByHousehold.set(g.householdId, [g]);
  }

  const recentActivity: ActivityItem[] = activityRows.map((row) => {
    const household = householdsById.get(row.householdId);
    const members = guestsByHousehold.get(row.householdId) ?? [];
    return {
      id: row.id,
      householdId: row.householdId,
      householdName: household ? householdLabel(household, members) : "Guest household",
      source: row.source,
      kind: row.kind,
      note: row.note,
      createdAtMs: row.createdAt.getTime(),
    };
  });

  const dateHeader = formatWeddingDateHeader(wedding.date, wedding.timeZone);

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi ${firstName(user.name)}`} description={dateHeader ?? undefined} />

      <SetupChecklistCard checklist={checklist} />

      <StatGrid>
        <StatTile
          label="Guests"
          value={stats.guests.total}
          detail={`${stats.households.total} ${stats.households.total === 1 ? "household" : "households"}`}
          href="/admin/guests"
        />
        <ResponseRateTile stats={stats} href="/admin/rsvp" />
        <AttendingTile stats={stats} href="/admin/rsvp" />
        <AwaitingTile stats={stats} href="/admin/rsvp" />
      </StatGrid>

      <EventStatsSection events={stats.events} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityCard items={recentActivity} />
        <GiftSummaryCard
          summary={giftSummary}
          hasAnyGiftsOrFunds={giftData.items.length > 0 || giftData.funds.length > 0}
          currency={wedding.currency}
        />
      </div>
    </div>
  );
}
