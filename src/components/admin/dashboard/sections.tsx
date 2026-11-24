import { EventAttendanceCard } from "@/components/admin/rsvp-stats";
import Link from "next/link";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  Progress,
} from "@/components/ui";
import { formatRelative } from "@/lib/dates";
import type { GiftSummary } from "@/lib/gifts";
import { formatMoney } from "@/lib/money";
import type { EventStats } from "@/lib/stats";
import { excerptNote, formatActivityAction, type SetupChecklistResult } from "./helpers";

export function SetupChecklistCard({ checklist }: { checklist: SetupChecklistResult }) {
  if (checklist.unfinished.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Get set up"
        description={`${checklist.completedCount} of ${checklist.totalCount} steps done`}
      />
      <CardBody className="space-y-4">
        <Progress
          value={checklist.completedCount}
          max={checklist.totalCount}
          tone="brand"
          label="Setup checklist progress"
        />
        <ul className="divide-y divide-line">
          {checklist.unfinished.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink group-hover:text-brand">{item.label}</p>
                  <p className="text-sm text-ink-muted">{item.description}</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-brand group-hover:underline">
                  Start →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function EventStatsSection({ events }: { events: EventStats[] }) {
  if (events.length === 0) {
    return (
      <section aria-labelledby="events-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="events-heading" className="text-base font-semibold text-ink">
            Events
          </h2>
          <Link href="/admin/schedule" className="text-sm font-medium text-brand hover:underline">
            Manage schedule
          </Link>
        </div>
        <EmptyState
          title="No RSVP events yet"
          body="Add events to your schedule and turn on RSVPs to track attendance here."
          action={
            <LinkButton href="/admin/schedule" variant="primary" size="sm">
              Add an event
            </LinkButton>
          }
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="events-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="events-heading" className="text-base font-semibold text-ink">
          Attendance by event
        </h2>
        <Link href="/admin/rsvp" className="text-sm font-medium text-brand hover:underline">
          View all RSVPs
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {events.map((event) => (
          <EventAttendanceCard key={event.eventId} event={event} />
        ))}
      </div>
    </section>
  );
}

export type ActivityItem = {
  id: string;
  householdId: string;
  householdName: string;
  source: "guest" | "host";
  kind: "first" | "update";
  note: string | null;
  createdAtMs: number;
};

export function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader
        title="Recent activity"
        description="Latest RSVP replies and edits."
        actions={
          <Link href="/admin/rsvp/activity" className="text-sm font-medium text-brand hover:underline">
            See all
          </Link>
        }
      />
      <CardBody>
        {items.length === 0 ? (
          <EmptyState
            title="No RSVP activity yet"
            body="Replies and notes from your guests will show up here as soon as they respond."
            action={
              <LinkButton href="/admin/guests" variant="secondary" size="sm">
                Manage guests
              </LinkButton>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const excerpt = excerptNote(item.note);
              return (
                <li key={item.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <p className="text-ink">
                      <Link
                        href={`/admin/guests/${item.householdId}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {item.householdName}
                      </Link>{" "}
                      <span className="text-ink-muted">{formatActivityAction(item.source, item.kind)}</span>
                    </p>
                    <span className="shrink-0 text-xs text-ink-faint">{formatRelative(item.createdAtMs)}</span>
                  </div>
                  {excerpt && <p className="text-sm text-ink-muted">&ldquo;{excerpt}&rdquo;</p>}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function GiftSummaryCard({
  summary,
  hasAnyGiftsOrFunds,
  currency,
}: {
  summary: GiftSummary;
  hasAnyGiftsOrFunds: boolean;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Gift list"
        description="Items claimed and cash fund contributions."
        actions={
          <Link href="/admin/gifts" className="text-sm font-medium text-brand hover:underline">
            Manage gift list
          </Link>
        }
      />
      <CardBody>
        {!hasAnyGiftsOrFunds ? (
          <EmptyState
            title="No gifts or cash funds yet"
            body="Add items to your gift list or set up a cash fund if you'd like to share ideas with guests."
            action={
              <LinkButton href="/admin/gifts" variant="secondary" size="sm">
                Set up gift list
              </LinkButton>
            }
          />
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-sunken/50 px-4 py-3">
                <dt className="text-xs font-medium text-ink-muted">Items gifted</dt>
                <dd className="mt-1 font-serif text-2xl font-medium text-ink tabular-nums">
                  {summary.items.fullyGifted} of {summary.items.listed}
                </dd>
                {summary.items.partlyGifted > 0 && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {summary.items.partlyGifted} partly gifted
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-line bg-sunken/50 px-4 py-3">
                <dt className="text-xs font-medium text-ink-muted">Cash funds</dt>
                <dd className="mt-1 font-serif text-2xl font-medium text-ink tabular-nums">
                  {formatMoney(summary.receivedCents, currency)}
                </dd>
                <p className="mt-0.5 text-xs text-ink-muted">
                  received · {formatMoney(summary.pledgedCents, currency)} pledged
                </p>
              </div>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
              <div className="flex items-center gap-2">
                {summary.toThank > 0 ? (
                  <Badge tone="warn">{summary.toThank} to thank</Badge>
                ) : summary.gifts > 0 ? (
                  <Badge tone="good">Thanked</Badge>
                ) : (
                  <span className="text-ink-muted">0 to thank</span>
                )}
              </div>
              <Link href="/admin/gifts" className="text-sm font-medium text-brand hover:underline">
                View gift tracker →
              </Link>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
