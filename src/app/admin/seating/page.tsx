import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { deleteTableAction, seatGuestsAction, unseatGuestAction } from "@/app/admin/seating/actions";
import { TableForm } from "@/components/admin/seating/table-forms";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  Notice,
  PageHeader,
  Progress,
  Select,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { seatingCandidates, type SeatingStatus } from "@/lib/planning";
import { describeDietary, hasNoNeeds } from "@/lib/rsvp/dietary";
import { guestName, householdLabel, type SnapGuest } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import { computeStats } from "@/lib/stats";
import { GUEST_EVENT_STATUS } from "@/lib/status-words";

export const metadata: Metadata = { title: "Seating" };

function StatusBadge({ status }: { status: SeatingStatus }) {
  if (status === "attending") return <Badge tone={GUEST_EVENT_STATUS.attending.tone}>{GUEST_EVENT_STATUS.attending.label}</Badge>;
  if (status === "pending") return <Badge tone={GUEST_EVENT_STATUS.pending.tone}>{GUEST_EVENT_STATUS.pending.label}</Badge>;
  return null;
}

export default async function SeatingPage() {
  const { wedding } = await requireHost();
  const [snapshot, tables, seats] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select()
      .from(schema.seatingTables)
      .where(eq(schema.seatingTables.weddingId, wedding.id))
      .orderBy(asc(schema.seatingTables.position), asc(schema.seatingTables.createdAt)),
    db.select().from(schema.seatAssignments).where(eq(schema.seatAssignments.weddingId, wedding.id)),
  ]);

  const candidates = seatingCandidates(snapshot);
  const stats = computeStats(snapshot);
  const dietary = new Map<string, string>();
  for (const q of stats.questions) {
    for (const p of q.dietary?.people ?? []) if (p.answer && !hasNoNeeds(p.answer)) dietary.set(p.guestId, describeDietary(p.answer));
  }
  const guestById = new Map(snapshot.guests.map((g) => [g.id, g]));
  const tableOf = new Map(seats.map((s) => [s.guestId, s.tableId]));
  const householdById = new Map(snapshot.households.map((h) => [h.id, h]));

  const seatedAt = (tableId: string) => seats.filter((s) => s.tableId === tableId).map((s) => guestById.get(s.guestId)).filter((g): g is SnapGuest => !!g);
  const unseated = snapshot.guests.filter((g) => candidates.has(g.id) && !tableOf.has(g.id));
  const unseatedByHousehold = new Map<string, SnapGuest[]>();
  for (const g of unseated) unseatedByHousehold.set(g.householdId, [...(unseatedByHousehold.get(g.householdId) ?? []), g]);
  const totalSeats = tables.reduce((s, t) => s + t.capacity, 0);
  const seatedCount = seats.filter((s) => guestById.has(s.guestId)).length;
  const declinedButSeated = seats.filter((s) => guestById.has(s.guestId) && !candidates.has(s.guestId)).length;

  const TablePicker = ({ name = "tableId" }: { name?: string }) => (
    <Select name={name} aria-label="Table" className="h-8 w-40" required defaultValue="">
      <option value="" disabled>
        Choose table…
      </option>
      {tables.map((t) => {
        const n = seats.filter((s) => s.tableId === t.id).length;
        return (
          <option key={t.id} value={t.id}>
            {t.name} ({n}/{t.capacity})
          </option>
        );
      })}
    </Select>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seating"
        description="Set up your reception tables and seat your guests. Only you can see this — it never appears on your website."
      />

      <StatGrid>
        <StatTile label="Tables" value={tables.length} detail={`${totalSeats} seats`} />
        <StatTile label="Seated" value={seatedCount} detail={<Progress value={seatedCount} max={Math.max(seatedCount + unseated.length, 1)} tone="good" label="Guests seated" />} />
        <StatTile label="Still to seat" value={unseated.length} detail="Attending or awaiting reply" />
        <StatTile
          label="Free seats"
          value={Math.max(totalSeats - seatedCount, 0)}
          detail={totalSeats - seatedCount - unseated.length < 0 ? `Add ${unseated.length - (totalSeats - seatedCount)} more seats` : "Enough for everyone"}
        />
      </StatGrid>

      {declinedButSeated > 0 && (
        <Notice tone="warn">
          {declinedButSeated} seated {declinedButSeated === 1 ? "guest has" : "guests have"} since declined. They’re marked below so you can free up their seats.
        </Notice>
      )}

      <Card>
        <CardHeader title="Add a table" />
        <CardBody>
          <TableForm nextNumber={tables.length + 1} />
        </CardBody>
      </Card>

      {tables.length === 0 ? (
        <EmptyState title="No tables yet" body="Add your tables above with how many seats each has, then seat guests from the list below." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tables.map((t) => {
            const people = seatedAt(t.id);
            const over = people.length > t.capacity;
            const needs = people.filter((p) => dietary.has(p.id)).length;
            return (
              <Card key={t.id}>
                <CardHeader
                  title={t.name}
                  description={
                    <>
                      <span className={over ? "font-medium text-bad" : undefined}>
                        {people.length} of {t.capacity} seats
                      </span>
                      {needs > 0 && ` · ${needs} with dietary needs`}
                      {t.notes && ` · ${t.notes}`}
                    </>
                  }
                />
                {people.length > 0 ? (
                  <ul className="divide-y divide-line">
                    {people.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-ink">
                            {guestName(p)}
                            {p.ageGroup === "child" && <span className="text-ink-muted"> · child</span>}
                            {!candidates.has(p.id) && <span className="ml-2"><Badge tone="bad">Declined</Badge></span>}
                          </p>
                          {dietary.get(p.id) && <p className="text-xs text-ink-muted">{dietary.get(p.id)}</p>}
                        </div>
                        <form action={unseatGuestAction}>
                          <input type="hidden" name="guestId" value={p.id} />
                          <Button type="submit" size="sm" variant="ghost" aria-label={`Remove ${guestName(p)} from ${t.name}`}>
                            Remove
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <CardBody>
                    <p className="text-sm text-ink-muted">Nobody seated yet.</p>
                  </CardBody>
                )}
                <details className="border-t border-line px-5 py-3">
                  <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Edit table</summary>
                  <div className="mt-3 space-y-3">
                    <TableForm table={t} />
                    <form action={deleteTableAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmButton confirm={`Delete ${t.name}?`} detail={people.length ? `${people.length} guests will go back to the “still to seat” list.` : undefined}>
                        Delete table
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader title={`Still to seat (${unseated.length})`} description="Grouped by invitation, so households can sit together." />
        {unseated.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-muted">{snapshot.guests.length === 0 ? "Add guests to your guest list first." : "Everyone has a seat."}</p>
          </CardBody>
        ) : tables.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-muted">Add a table to start seating these {unseated.length} guests.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {[...unseatedByHousehold.entries()].map(([householdId, members]) => {
              const household = householdById.get(householdId);
              const all = snapshot.guests.filter((g) => g.householdId === householdId);
              return (
                <li key={householdId} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">{household ? householdLabel(household, all) : "Guests"}</p>
                    {members.length > 1 && (
                      <form action={seatGuestsAction} className="flex items-center gap-2">
                        {members.map((m) => (
                          <input key={m.id} type="hidden" name="guestId" value={m.id} />
                        ))}
                        <TablePicker />
                        <Button type="submit" size="sm" variant="secondary">
                          Seat all {members.length}
                        </Button>
                      </form>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {members.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 pl-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                            {guestName(m)}
                            {m.ageGroup === "child" && <span className="text-ink-muted">child</span>}
                            <StatusBadge status={candidates.get(m.id)!} />
                          </p>
                          {dietary.get(m.id) && <p className="text-xs text-ink-muted">{dietary.get(m.id)}</p>}
                        </div>
                        <form action={seatGuestsAction} className="flex items-center gap-2">
                          <input type="hidden" name="guestId" value={m.id} />
                          <TablePicker />
                          <Button type="submit" size="sm" variant="ghost">
                            Seat
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
