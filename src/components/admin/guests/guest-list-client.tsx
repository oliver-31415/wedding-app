"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  LinkButton,
  Select,
  Table,
  Td,
  Th,
  cn,
} from "@/components/ui";
import { filterHouseholds, type GuestListEventStatus, type GuestListHousehold } from "@/lib/guests/filter";
import { GUEST_EVENT_STATUS_META, HOUSEHOLD_STATE_META } from "@/lib/guests/status";
import type { HouseholdRsvpState } from "@/lib/rsvp/model";

type TagOption = { id: string; name: string };

const EVENT_DOT_CLASS = {
  attending: "bg-good",
  declined: "bg-bad",
  pending: "bg-warn",
  not_invited: "bg-line-strong",
} as const;

const EVENT_PILL_CLASS = {
  attending: "bg-good-soft text-good",
  declined: "bg-bad-soft text-bad",
  pending: "bg-warn-soft text-warn",
  not_invited: "bg-neutral-soft text-ink-muted",
} as const;

function EventStatusChips({ statuses }: { statuses: GuestListEventStatus[] }) {
  if (statuses.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {statuses.map((ev) => {
        const meta = GUEST_EVENT_STATUS_META[ev.status];
        return (
          <span
            key={ev.eventId}
            title={`${ev.eventName}: ${meta.label}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              EVENT_PILL_CLASS[ev.status],
            )}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", EVENT_DOT_CLASS[ev.status])} />
            <span>{ev.eventName}</span>
            <span className="sr-only">: {meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export function GuestListClient({
  households,
  tags,
  hasRsvpEvents,
}: {
  households: GuestListHousehold[];
  tags: TagOption[];
  hasRsvpEvents: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tagId, setTagId] = useState("all");
  const [rsvpState, setRsvpState] = useState<HouseholdRsvpState | "all">("all");

  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  const filtered = useMemo(
    () => filterHouseholds(households, { query, tagId, rsvpState }),
    [households, query, tagId, rsvpState],
  );

  const hasFilters = query.trim() !== "" || tagId !== "all" || rsvpState !== "all";

  if (households.length === 0) {
    return (
      <EmptyState
        title="No guests yet"
        body="Guests are grouped into households — the people who RSVP together (a single guest is a household of one). Add your first household or import a CSV spreadsheet."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <LinkButton href="/admin/guests/new" variant="primary">
              Add household
            </LinkButton>
            <LinkButton href="/admin/guests/import" variant="secondary">
              Import CSV
            </LinkButton>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_13rem]">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search guests by name or email"
            />
            <Select value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Filter by tag">
              <option value="all">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select
              value={rsvpState}
              onChange={(e) => setRsvpState(e.target.value as HouseholdRsvpState | "all")}
              aria-label="Filter by RSVP status"
            >
              <option value="all">All RSVP states</option>
              <option value="complete">Replied</option>
              <option value="partial">Partly replied</option>
              <option value="not_started">Awaiting reply</option>
              <option value="none">No RSVP needed</option>
            </Select>
          </div>

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
              <span>
                Showing {filtered.length} of {households.length} {households.length === 1 ? "household" : "households"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setTagId("all");
                  setRsvpState("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching households"
          body="Try a different search or clear your filters to see everyone."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setTagId("all");
                setRsvpState("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop grouped table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Household &amp; guests</Th>
                  <Th>Tags</Th>
                  {hasRsvpEvents && <Th>Events</Th>}
                  <Th className="text-right">RSVP</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const stateMeta = HOUSEHOLD_STATE_META[h.rsvpState];
                  const householdTags = [
                    ...new Set(h.members.flatMap((m) => m.tagIds)),
                  ]
                    .map((id) => ({ id, name: tagNameById.get(id) }))
                    .filter((t): t is { id: string; name: string } => Boolean(t.name));

                  return (
                    <tr
                      key={h.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a, button")) return;
                        router.push(`/admin/guests/${h.id}`);
                      }}
                      className="cursor-pointer transition-colors hover:bg-sunken/60"
                    >
                      <Td>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/guests/${h.id}`}
                              className="font-medium text-ink hover:text-brand hover:underline"
                            >
                              {h.label}
                            </Link>
                            {h.plusOnesRemaining > 0 && (
                              <span className="text-xs text-ink-muted">
                                +{h.plusOnesRemaining} unnamed {h.plusOnesRemaining === 1 ? "plus-one" : "plus-ones"}
                              </span>
                            )}
                          </div>
                          <ul className="space-y-1">
                            {h.members.map((m) => (
                              <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                                <span className="text-ink">
                                  {m.firstName} {m.lastName}
                                </span>
                                {m.ageGroup === "child" && <Badge tone="info">Child</Badge>}
                                {m.isPlusOne && <Badge tone="brand">Plus-one</Badge>}
                                {m.email && <span className="text-xs text-ink-muted">{m.email}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Td>

                      <Td>
                        {householdTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {householdTags.map((t) => (
                              <Badge key={t.id} tone="neutral">
                                {t.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-ink-faint">—</span>
                        )}
                      </Td>

                      {hasRsvpEvents && (
                        <Td>
                          <div className="space-y-1.5">
                            {h.members.map((m) => (
                              <div key={m.id} className="flex flex-wrap items-center gap-1.5">
                                {h.members.length > 1 && (
                                  <span className="text-xs text-ink-muted">{m.firstName}:</span>
                                )}
                                {m.eventStatuses.length > 0 ? (
                                  <EventStatusChips statuses={m.eventStatuses} />
                                ) : (
                                  <span className="text-xs text-ink-faint">Not invited</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </Td>
                      )}

                      <Td className="text-right">
                        <Badge tone={stateMeta.tone}>{stateMeta.label}</Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {hasRsvpEvents && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-sunken/40 px-4 py-2.5 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-good" /> Attending
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-bad" /> Declined
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-warn" /> Awaiting reply
                </span>
              </div>
            )}
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((h) => {
              const stateMeta = HOUSEHOLD_STATE_META[h.rsvpState];
              return (
                <Link
                  key={h.id}
                  href={`/admin/guests/${h.id}`}
                  className="block rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{h.label}</p>
                      {h.plusOnesRemaining > 0 && (
                        <p className="text-xs text-ink-muted">
                          +{h.plusOnesRemaining} unnamed {h.plusOnesRemaining === 1 ? "plus-one" : "plus-ones"}
                        </p>
                      )}
                    </div>
                    <Badge tone={stateMeta.tone}>{stateMeta.label}</Badge>
                  </div>

                  <ul className="mt-3 space-y-2.5 border-t border-line pt-3">
                    {h.members.map((m) => {
                      const memberTags = m.tagIds
                        .map((id) => tagNameById.get(id))
                        .filter((n): n is string => Boolean(n));
                      return (
                        <li key={m.id} className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-ink">
                              {m.firstName} {m.lastName}
                            </span>
                            {m.ageGroup === "child" && <Badge tone="info">Child</Badge>}
                            {m.isPlusOne && <Badge tone="brand">Plus-one</Badge>}
                          </div>
                          {m.email && <p className="truncate text-xs text-ink-muted">{m.email}</p>}
                          {memberTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {memberTags.map((name) => (
                                <Badge key={name} tone="neutral">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {m.eventStatuses.length > 0 && <EventStatusChips statuses={m.eventStatuses} />}
                        </li>
                      );
                    })}
                  </ul>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
