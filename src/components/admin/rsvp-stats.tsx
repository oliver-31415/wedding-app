/**
 * RSVP statistics shown on more than one admin screen (dashboard, RSVPs).
 * One component per statistic so the same number is always worded and
 * drawn the same way.
 */
import { Card, CardBody, CardHeader, Progress, SegmentBar, StatTile } from "@/components/ui";
import { pct, type EventStats, type WeddingStats } from "@/lib/stats";
import { count, plural } from "@/lib/words";

export function ResponseRateTile({ stats, href }: { stats: WeddingStats; href?: string }) {
  const { n, of } = stats.responseRate;
  return (
    <StatTile
      label="Response rate"
      value={of === 0 ? "—" : `${pct(stats.responseRate)}%`}
      href={href}
      detail={
        of === 0 ? (
          "No RSVPs requested yet"
        ) : (
          <>
            <p>
              {n} of {count(of, "household")} replied
            </p>
            <Progress value={n} max={of} tone="good" label="Household response rate" />
          </>
        )
      }
    />
  );
}

export function AttendingTile({ stats, href }: { stats: WeddingStats; href?: string }) {
  return (
    <StatTile
      label="Attending"
      value={stats.attendingAnything}
      detail={`${plural(stats.attendingAnything, "guest")} coming to at least one event`}
      href={href}
    />
  );
}

export function AwaitingTile({ stats, href }: { stats: WeddingStats; href?: string }) {
  const awaiting = stats.households.not_started + stats.households.partial;
  return (
    <StatTile
      label="Awaiting reply"
      value={awaiting}
      href={href}
      detail={
        stats.households.partial > 0
          ? `${plural(awaiting, "household")}, ${stats.households.partial} partly replied`
          : `${plural(awaiting, "household")} yet to reply`
      }
    />
  );
}

/** Attending / declined / awaiting for one event, with the headcount split. */
export function EventAttendanceCard({ event }: { event: EventStats }) {
  return (
    <Card>
      <CardHeader title={event.name} description={`${count(event.invited, "guest")} invited`} />
      <CardBody className="space-y-3">
        <SegmentBar
          label={`${event.name} attendance`}
          segments={[
            { label: "Attending", value: event.attending, tone: "good" },
            { label: "Declined", value: event.declined, tone: "bad" },
            { label: "Awaiting reply", value: event.pending, tone: "warn" },
          ]}
        />
        <p className="text-sm text-ink-muted">
          Coming: {count(event.attendingAdults, "adult")} · {count(event.attendingChildren, "child", "children")}
          {event.openPlusOnes > 0 && (
            <>
              {" · "}
              <span className="text-ink">up to {count(event.openPlusOnes, "more plus-one", "more plus-ones")}</span>
            </>
          )}
        </p>
      </CardBody>
    </Card>
  );
}
