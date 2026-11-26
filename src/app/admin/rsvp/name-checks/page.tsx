import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { NameChecks, type NameCheckGuest, type NameCheckHousehold } from "@/components/admin/rsvp/name-checks";
import { RsvpSubNav } from "@/components/admin/rsvp/rsvp-sub-nav";
import { Badge, Card, CardHeader, ConfirmButton, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatRelative } from "@/lib/dates";
import { NAME_CHECKS_PATH } from "@/lib/name-checks";
import { nameKey, suggestGuests, type NameAlias } from "@/lib/rsvp/lookup";
import {
  attendanceKey,
  guestName,
  householdLabel,
  householdRsvpState,
  isInvited,
  type SnapGuest,
} from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import { forgetNameAliasAction } from "./actions";

export const metadata: Metadata = { title: "Name checks" };

const SUGGESTIONS = 4;

export default async function NameChecksPage() {
  const { wedding } = await requireHost();
  const [snapshot, pending, resolved] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select()
      .from(schema.nameRequests)
      .where(and(eq(schema.nameRequests.weddingId, wedding.id), eq(schema.nameRequests.status, "pending")))
      .orderBy(asc(schema.nameRequests.createdAt)),
    db
      .select()
      .from(schema.nameRequests)
      .where(and(eq(schema.nameRequests.weddingId, wedding.id), ne(schema.nameRequests.status, "pending")))
      .orderBy(desc(schema.nameRequests.resolvedAt)),
  ]);

  // Who each guest is and what they're invited to: this is what tells you
  // whether accepting someone invites them to the reception.
  const events = [...snapshot.events].sort((a, b) => a.position - b.position);
  const responses = new Map(snapshot.responses.map((r) => [attendanceKey(r.guestId, r.eventId), r.attending]));
  const membersOf = new Map<string, SnapGuest[]>();
  for (const g of snapshot.guests) membersOf.set(g.householdId, [...(membersOf.get(g.householdId) ?? []), g]);
  const households: NameCheckHousehold[] = [];
  const guests: Record<string, NameCheckGuest> = {};
  for (const h of snapshot.households) {
    const members = membersOf.get(h.id) ?? [];
    if (members.length === 0) continue;
    const label = householdLabel(h, members);
    const state = householdRsvpState(members, snapshot.events, responses);
    households.push({ id: h.id, label, guestIds: members.map((g) => g.id) });
    for (const g of members) {
      guests[g.id] = {
        id: g.id,
        name: guestName(g),
        firstName: g.firstName,
        email: g.email,
        householdId: h.id,
        householdLabel: label,
        householdState: state,
        invitedTo: events.filter((e) => isInvited(g, e, members)).map((e) => e.name),
        notInvitedTo: events.filter((e) => !isInvited(g, e, members)).map((e) => e.name),
      };
    }
  }
  households.sort((a, b) => a.label.localeCompare(b.label, "en-AU"));

  const accepted = resolved.filter((r) => r.status === "accepted" && r.guestId && guests[r.guestId]);
  const aliases: NameAlias[] = accepted.map((r) => ({ firstName: r.firstName, lastName: r.lastName, guestId: r.guestId }));
  const requests = pending.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    note: r.note,
    sent: formatRelative(r.createdAt.getTime()),
    suggestions: suggestGuests(r.firstName, r.lastName, snapshot.guests, SUGGESTIONS, aliases).map((s) => ({
      guestId: s.guest.id,
      reason: s.reason,
      tier: s.tier,
    })),
  }));
  // Accepted names that differ from the guest's own, i.e. that the lookup now recognises.
  const snapGuest = new Map(snapshot.guests.map((g) => [g.id, g]));
  const aliasRows = accepted.filter((r) => {
    const g = snapGuest.get(r.guestId!)!;
    return nameKey(r.firstName, r.lastName) !== nameKey(g.firstName, g.lastName);
  });

  return (
    <div>
      <PageHeader
        title="RSVPs"
        description="Guests who couldn't find their invitation and asked you to check their name."
      />
      <RsvpSubNav current={NAME_CHECKS_PATH} />
      <div className="space-y-6">
        <NameChecks requests={requests} guests={guests} households={households} />

        {aliasRows.length > 0 && (
          <Card>
            <CardHeader
              title="Names we recognise"
              description="When someone types one of these, they go straight to that guest's invitation."
            />
            <ul className="divide-y divide-line">
              {aliasRows.map((r) => {
                const g = guests[r.guestId!];
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span className="text-ink">
                      {r.firstName} {r.lastName} <span className="text-ink-muted">→</span>{" "}
                      <Link href={`/admin/guests/${g.householdId}`} className="font-medium hover:text-brand hover:underline">
                        {g.name}
                      </Link>
                    </span>
                    <form action={forgetNameAliasAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmButton
                        variant="ghost"
                        confirm={`Forget "${r.firstName} ${r.lastName}"?`}
                        detail={`Typing that name won't find ${g.name}'s invitation any more. Their personal link still works.`}
                        confirmLabel="Forget"
                      >
                        Forget
                      </ConfirmButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {resolved.length > 0 && (
          <details className="group rounded-[var(--radius-card)] border border-line bg-surface">
            <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-ink">
              Dealt with <span className="font-normal text-ink-muted">({resolved.length})</span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {resolved.map((r) => {
                const g = r.guestId ? guests[r.guestId] : null;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span className="min-w-0 text-ink">
                      {r.firstName} {r.lastName}
                      {r.status === "accepted" && (
                        <span className="text-ink-muted"> → {g ? g.name : "a guest no longer on your list"}</span>
                      )}
                      <span className="block break-all text-ink-muted">{r.email}</span>
                    </span>
                    <span className="flex items-center gap-2 text-ink-muted">
                      {r.status === "accepted" ? <Badge tone="good">Accepted</Badge> : <Badge>Dismissed</Badge>}
                      {r.resolvedAt ? formatRelative(r.resolvedAt.getTime()) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
