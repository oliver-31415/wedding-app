import Link from "next/link";
import { desc, and, eq } from "drizzle-orm";
import { MarkReachedForm, UnmarkReachedButton } from "@/components/admin/messages/mark-reached";
import { formatTimestamp } from "@/components/admin/messages/format";
import { Badge, Card, CardHeader, DeliveryBadge } from "@/components/ui";
import { db, schema } from "@/db";
import { DELIVERY_METHOD_META } from "@/lib/messaging/delivery-methods";
import { deliveriesFor, notReached } from "@/lib/messaging/reach";
import { selectRecipients } from "@/lib/messaging/recipients";
import { MESSAGE_KIND_META } from "@/lib/messaging/templates";
import type { WeddingSnapshot } from "@/lib/stats";

/**
 * Every sent message meant for this household, and how it reached them —
 * emailed by the app, or marked by the couple as posted, texted or given in
 * person — with a way to mark the ones still waiting.
 */
export async function HouseholdMessages({
  weddingId,
  timeZone,
  householdId,
  snapshot,
}: {
  weddingId: string;
  timeZone: string;
  householdId: string;
  snapshot: WeddingSnapshot;
}) {
  const sent = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.weddingId, weddingId), eq(schema.messages.status, "sent")))
    .orderBy(desc(schema.messages.sentAt));
  if (!sent.length) return null;

  const members = snapshot.guests.filter((g) => g.householdId === householdId);
  const memberIds = new Set(members.map((g) => g.id));
  const nameOf = new Map(members.map((g) => [g.id, `${g.firstName} ${g.lastName}`]));
  const allDeliveries = await deliveriesFor(weddingId, sent.map((m) => m.id));

  const rows = sent
    .map((message) => {
      const deliveries = allDeliveries.filter((d) => d.messageId === message.id);
      const mine = deliveries.filter((d) => d.guestId && memberIds.has(d.guestId));
      const waiting = notReached(snapshot, message, deliveries).filter((w) => w.householdId === householdId);
      const meantForThem = selectRecipients(snapshot, message.recipients).recipients.some((r) => r.householdId === householdId);
      return { message, mine, waiting, include: mine.length > 0 || waiting.length > 0 || meantForThem };
    })
    .filter((r) => r.include);
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader
        title="Messages"
        description="What's been sent to this household, and how. Mark anything you posted, texted or passed on in person."
      />
      <ul className="divide-y divide-line">
        {rows.map(({ message, mine, waiting }) => (
          <li key={message.id} className="space-y-2 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/admin/messages/${message.id}`} className="text-sm font-medium text-ink hover:text-brand hover:underline">
                {message.subject || MESSAGE_KIND_META[message.kind].label}
              </Link>
              <span className="text-xs text-ink-muted">
                {MESSAGE_KIND_META[message.kind].label}
                {message.sentAt ? ` · ${formatTimestamp(message.sentAt, timeZone)}` : ""}
              </span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {mine.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">{(d.guestId && nameOf.get(d.guestId)) ?? "Guest"}</span>
                  {d.status === "sent" ? (
                    <Badge tone={DELIVERY_METHOD_META[d.method].tone}>{DELIVERY_METHOD_META[d.method].label}</Badge>
                  ) : d.status === "queued" ? (
                    <DeliveryBadge status="queued" />
                  ) : (
                    <Badge tone="bad">Email failed</Badge>
                  )}
                  {d.email && <span className="text-ink-muted">{d.email}</span>}
                  {d.method !== "email" && <UnmarkReachedButton deliveryId={d.id} />}
                </li>
              ))}
              {waiting.length > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warn-soft/50 px-3 py-2">
                  <span className="text-ink">
                    Not reached yet: {waiting.map((w) => w.name).join(", ")}
                  </span>
                  <MarkReachedForm
                    messageId={message.id}
                    guestIds={waiting.map((w) => w.guestId)}
                    idSuffix={`${message.id}-${householdId}`}
                  />
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
