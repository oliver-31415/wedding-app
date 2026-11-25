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
import { BudgetCard, ChecklistCard, PaymentsDueCard } from "@/components/admin/dashboard/planning";
import { AttendingTile, AwaitingTile, ResponseRateTile } from "@/components/admin/rsvp-stats";
import { PageHeader, StatGrid, StatTile } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { computeGiftSummary } from "@/lib/gifts";
import { paymentState, taskGroup, upcomingPayments } from "@/lib/planning";
import { loadBudgetData, loadHosts } from "@/lib/planning-data";
import { loadGiftData } from "@/lib/gifts-data";
import { householdLabel, type SnapGuest } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import { computeStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { user, wedding } = await requireHost();

  const [snapshot, giftData, weddingPages, activityRows, budget, tasks, hosts] = await Promise.all([
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
    loadBudgetData(wedding),
    db.select().from(schema.tasks).where(eq(schema.tasks.weddingId, wedding.id)),
    loadHosts(wedding.id),
  ]);

  const today = todayIn(wedding.timeZone);
  const vendorName = new Map(budget.vendors.map((v) => [v.id, v.name]));
  const dueSoon = upcomingPayments(budget.payments)
    .filter((p) => ["overdue", "due_soon"].includes(paymentState(p, today)))
    .slice(0, 5)
    .map((p) => ({ ...p, vendorName: vendorName.get(p.vendorId) ?? "Vendor" }));
  const thisWeek = tasks
    .map((t) => ({ ...t, group: taskGroup(t, today) }))
    .filter((t) => t.group === "overdue" || t.group === "this_week")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6)
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, assigneeId: t.assigneeId, overdue: t.group === "overdue" }));

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChecklistCard
          tasks={thisWeek}
          done={tasks.filter((t) => t.doneAt).length}
          total={tasks.length}
          hostName={new Map(hosts.map((h) => [h.id, h.name]))}
        />
        <BudgetCard summary={budget.summary} currency={wedding.currency} />
        <PaymentsDueCard payments={dueSoon} today={today} currency={wedding.currency} />
      </div>

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
