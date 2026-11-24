import Link from "next/link";
import { and, count, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { RsvpSubNav } from "@/components/admin/rsvp/rsvp-sub-nav";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  TextBlock,
} from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatRelative } from "@/lib/dates";
import {
  describeActivityAction,
  formatInstantInZone,
} from "@/lib/rsvp-admin/summary";
import { householdLabel, type SnapGuest } from "@/lib/rsvp/model";

const PAGE_SIZE = 50;

function activityHref(page: number, notesOnly: boolean): string {
  const params = new URLSearchParams();
  if (notesOnly) params.set("notes", "1");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/rsvp/activity?${qs}` : "/admin/rsvp/activity";
}

export default async function RsvpActivityPage({
  searchParams,
}: PageProps<"/admin/rsvp/activity">) {
  const { wedding } = await requireHost();
  const query = await searchParams;

  const notesOnly = query.notes === "1" || query.notes === "true";
  const rawPage = Number.parseInt(
    typeof query.page === "string" ? query.page : "1",
    10,
  );
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const whereClause = notesOnly
    ? and(
        eq(schema.rsvpActivity.weddingId, wedding.id),
        isNotNull(schema.rsvpActivity.note),
        ne(schema.rsvpActivity.note, ""),
      )
    : eq(schema.rsvpActivity.weddingId, wedding.id);

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.rsvpActivity)
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const entries = await db
    .select()
    .from(schema.rsvpActivity)
    .where(whereClause)
    .orderBy(desc(schema.rsvpActivity.createdAt), desc(schema.rsvpActivity.id))
    .limit(PAGE_SIZE)
    .offset(offset);

  const householdIds = Array.from(new Set(entries.map((e) => e.householdId)));
  const [householdRows, guestRows] =
    householdIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: schema.households.id,
              envelopeName: schema.households.envelopeName,
            })
            .from(schema.households)
            .where(
              and(
                eq(schema.households.weddingId, wedding.id),
                inArray(schema.households.id, householdIds),
              ),
            ),
          db
            .select()
            .from(schema.guests)
            .where(
              and(
                eq(schema.guests.weddingId, wedding.id),
                inArray(schema.guests.householdId, householdIds),
              ),
            ),
        ])
      : [[], []];

  const householdById = new Map(householdRows.map((h) => [h.id, h]));
  const guestsByHousehold = new Map<string, SnapGuest[]>();
  for (const g of guestRows) {
    const snap: SnapGuest = {
      id: g.id,
      householdId: g.householdId,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      ageGroup: g.ageGroup,
      isPlusOne: g.isPlusOne,
      tagIds: [],
    };
    const list = guestsByHousehold.get(g.householdId);
    if (list) list.push(snap);
    else guestsByHousehold.set(g.householdId, [snap]);
  }

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + entries.length, total);

  return (
    <div>
      <PageHeader
        title="RSVP activity"
        description="A timeline of guest replies, updates and notes to you."
      />

      <RsvpSubNav current="/admin/rsvp/activity" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LinkButton
            href={activityHref(1, false)}
            variant={!notesOnly ? "primary" : "secondary"}
            size="sm"
          >
            All activity
          </LinkButton>
          <LinkButton
            href={activityHref(1, true)}
            variant={notesOnly ? "primary" : "secondary"}
            size="sm"
          >
            Only with notes
          </LinkButton>
        </div>
        {total > 0 && (
          <p className="text-sm text-ink-muted tabular-nums">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        notesOnly ? (
          <EmptyState
            title="No notes yet"
            body="None of your RSVP replies include a note to you yet."
            action={
              <LinkButton href="/admin/rsvp/activity" variant="secondary">
                Show all activity
              </LinkButton>
            }
          />
        ) : (
          <EmptyState
            title="No RSVP activity yet"
            body="When guests reply or update their RSVP, each submission and any note they leave will show up here."
          />
        )
      ) : (
        <div className="space-y-4">
          <Card>
            <ul className="divide-y divide-line">
              {entries.map((entry) => {
                const hh = householdById.get(entry.householdId);
                const members = guestsByHousehold.get(entry.householdId) ?? [];
                const label = hh
                  ? householdLabel(hh, members)
                  : "Unknown household";
                const actionText = describeActivityAction(
                  entry.source,
                  entry.kind,
                );
                const timestamp = entry.createdAt.getTime();
                const relative = formatRelative(timestamp);
                const absolute = formatInstantInZone(
                  timestamp,
                  wedding.timeZone,
                );
                const hasNote = Boolean(entry.note?.trim());

                return (
                  <li key={entry.id} className="space-y-2.5 px-5 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                        <Link
                          href={`/admin/guests/${entry.householdId}`}
                          className="font-medium text-ink hover:text-brand hover:underline"
                        >
                          {label}
                        </Link>
                        <span className="text-ink-muted">{actionText}</span>
                        {entry.source === "host" && (
                          <Badge tone="info">Host</Badge>
                        )}
                      </div>
                      <time
                        dateTime={entry.createdAt.toISOString()}
                        className="text-xs text-ink-muted whitespace-nowrap"
                      >
                        {relative} · {absolute}
                      </time>
                    </div>

                    {hasNote && (
                      <div className="rounded-lg border border-brand/20 bg-brand-soft/60 px-3.5 py-2.5 text-sm text-ink">
                        <TextBlock text={entry.note} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <LinkButton
                    href={activityHref(page - 1, notesOnly)}
                    variant="secondary"
                    size="sm"
                  >
                    Previous
                  </LinkButton>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-sm text-ink-faint">
                    Previous
                  </span>
                )}
                {page < totalPages ? (
                  <LinkButton
                    href={activityHref(page + 1, notesOnly)}
                    variant="secondary"
                    size="sm"
                  >
                    Next
                  </LinkButton>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-sm text-ink-faint">
                    Next
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-muted tabular-nums">
                Page {page} of {totalPages}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
