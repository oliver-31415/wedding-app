import { eventNeedsGuest } from "@/lib/event-visibility";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { deleteEventAction, reorderEventAction } from "@/app/admin/schedule/actions";
import {
  Badge,
  Card,
  CardHeader,
  ConfirmButton,
  EmptyState,
  LinkButton,
  PageHeader,
  ReorderButtons,
} from "@/components/ui";
import { db, schema } from "@/db";
import { describeAudience } from "@/lib/audience";
import { requireHost } from "@/lib/auth";
import { formatDateLong, formatTimeRange } from "@/lib/dates";

export default async function SchedulePage() {
  const { wedding } = await requireHost();

  const [events, tags, schedulePages] = await Promise.all([
    db
      .select()
      .from(schema.events)
      .where(eq(schema.events.weddingId, wedding.id))
      .orderBy(asc(schema.events.position), asc(schema.events.createdAt)),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id)),
    db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(and(eq(schema.pages.weddingId, wedding.id), eq(schema.pages.type, "schedule")))
      .limit(1),
  ]);

  const tagNames = new Map(tags.map((t) => [t.id, t.name]));
  const schedulePage = schedulePages[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Events appear on your schedule page and decide what guests can RSVP to."
        actions={
          <>
            {schedulePage ? (
              <LinkButton href={`/admin/website/${schedulePage.id}`} variant="secondary" size="sm">
                Edit schedule page
              </LinkButton>
            ) : (
              <LinkButton href="/admin/website" variant="secondary" size="sm">
                Add schedule page
              </LinkButton>
            )}
            <LinkButton href="/admin/schedule/new" variant="primary" size="sm">
              Add event
            </LinkButton>
          </>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          body="Add your ceremony, reception, or any other gatherings. Guests only see events they’re invited to."
          action={
            <LinkButton href="/admin/schedule/new" variant="primary">
              Add event
            </LinkButton>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Events"
            description="Shown in this order on your schedule page and RSVP form."
          />
          <ul className="divide-y divide-line">
            {events.map((event, i) => {
              const audienceText = describeAudience(event.audience, tagNames);
              const dateTimeText = event.startsAt
                ? `${formatDateLong(event.startsAt)} · ${formatTimeRange(event.startsAt, event.endsAt)}`
                : "Time to be announced";
              const venueLine = [event.venueName, event.address].filter(Boolean).join(" — ");

              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/schedule/${event.id}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {event.name}
                      </Link>
                      <Badge tone={event.audience.mode === "all" ? "neutral" : "brand"}>
                        {audienceText}
                      </Badge>
                      {eventNeedsGuest(event) && <Badge tone="neutral">Hidden until guests find their invitation</Badge>}
                      {event.rsvpEnabled && <Badge tone="info">Collects RSVPs</Badge>}
                    </div>
                    <p className="text-sm text-ink-muted">{dateTimeText}</p>
                    {venueLine && <p className="text-sm text-ink-muted">{venueLine}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <ReorderButtons
                      id={event.id}
                      action={reorderEventAction}
                      isFirst={i === 0}
                      isLast={i === events.length - 1}
                      label={event.name}
                    />
                    <LinkButton href={`/admin/schedule/${event.id}`} variant="secondary" size="sm">
                      Edit
                    </LinkButton>
                    <form action={deleteEventAction}>
                      <input type="hidden" name="id" value={event.id} />
                      <ConfirmButton
                        confirm={`Delete "${event.name}"? Any RSVP answers guests gave for this event will be deleted too.`}
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
