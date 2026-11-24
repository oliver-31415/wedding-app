import { createDraftAction } from "@/app/admin/messages/new/actions";
import { AttendingTile, AwaitingTile, EventAttendanceCard, ResponseRateTile } from "@/components/admin/rsvp-stats";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { RsvpSubNav } from "@/components/admin/rsvp/rsvp-sub-nav";
import { TextAnswerList } from "@/components/admin/rsvp/text-answer-list";
import {
  Badge,
  BarList,
  buttonClass,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Button,
  LinkButton,
  Notice,
  PageHeader,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { describeQuestionConditions } from "@/lib/rsvp-admin/conditions";
import {
  countDeclinedAllInvited,
  describeDeadlineLine,
  getPendingHouseholds,
} from "@/lib/rsvp-admin/summary";
import { loadSnapshot } from "@/lib/snapshot";
import { computeStats } from "@/lib/stats";

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? singular : pluralForm;
}

export default async function RsvpResponsesPage() {
  const { wedding } = await requireHost();

  const [snapshot, weddingTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const stats = computeStats(snapshot);
  const declinedAll = countDeclinedAllInvited(snapshot);
  const pendingHouseholds = getPendingHouseholds(snapshot);
  const deadline = describeDeadlineLine(wedding);
  const hasAnyResponses = snapshot.responses.length > 0;

  const conditionLookups = {
    eventsById: new Map(
      snapshot.events.map((e) => [e.id, { id: e.id, name: e.name, rsvpEnabled: e.rsvpEnabled }]),
    ),
    questionsById: new Map(
      snapshot.questions.map((q) => [
        q.id,
        { id: q.id, label: q.label, options: q.options, archived: q.archived },
      ]),
    ),
    tagsById: new Map(weddingTags.map((t) => [t.id, t.name])),
  };
  const questionById = new Map(snapshot.questions.map((q) => [q.id, q]));

  return (
    <div>
      <PageHeader
        title="RSVPs"
        description="Track attendance, meal choices and who you're still waiting on."
        actions={
          <a
            href="/admin/guests/export.csv"
            className={buttonClass("secondary")}
          >
            Export all responses (CSV)
          </a>
        }
      />

      <RsvpSubNav current="/admin/rsvp" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={deadline.open ? "good" : "warn"}>
            {deadline.open ? "Open" : "Closed"}
          </Badge>
          {deadline.noDeadline ? (
            <span className="text-ink">
              No deadline set.{" "}
              <Link href="/admin/rsvp/settings" className="font-medium text-brand hover:underline">
                Set one in settings
              </Link>
            </span>
          ) : (
            <span className="text-ink">
              <span className="font-medium">{deadline.headline}</span>
              {deadline.detail && (
                <span className="text-ink-muted"> · {deadline.detail}</span>
              )}
            </span>
          )}
        </div>
        <Link
          href="/admin/rsvp/settings"
          className="text-sm font-medium text-brand hover:underline"
        >
          RSVP settings
        </Link>
      </div>

      {stats.events.length === 0 ? (
        <EmptyState
          title="No events collect RSVPs yet"
          body="Turn on RSVPs for at least one event in your schedule so guests can reply and you can track responses here."
          action={
            <LinkButton href="/admin/schedule" variant="primary">
              Go to schedule
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-8">
          <StatGrid>
            <ResponseRateTile stats={stats} />
            <AttendingTile stats={stats} />
            <StatTile label="Declined" value={declinedAll} detail={`${plural(declinedAll, "guest")} can't come to anything`} />
            <AwaitingTile stats={stats} />
          </StatGrid>

          {!hasAnyResponses && (
            <Notice tone="info" title="No responses yet">
              Once guests reply to your wedding website, their attendance and answers will appear here.
            </Notice>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">By event</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {stats.events.map((ev) => (
                <EventAttendanceCard key={ev.eventId} event={ev} />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">Questions</h2>
              <Link
                href="/admin/rsvp/questions"
                className="text-sm font-medium text-brand hover:underline"
              >
                Manage questions
              </Link>
            </div>

            {stats.questions.length === 0 ? (
              <EmptyState
                title="No RSVP questions yet"
                body="Add questions to collect meal choices, dietary requirements, song requests, or anything else from your guests."
                action={
                  <LinkButton href="/admin/rsvp/questions/new" variant="secondary">
                    Add a question
                  </LinkButton>
                }
              />
            ) : (
              <div className="space-y-4">
                {stats.questions.map((q) => {
                  const full = questionById.get(q.questionId);
                  const conditions = full
                    ? describeQuestionConditions(full, conditionLookups)
                    : [];

                  return (
                    <Card key={q.questionId}>
                      <CardHeader
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{q.label}</span>
                            {q.scope === "household" && (
                              <Badge tone="neutral">Per household</Badge>
                            )}
                          </span>
                        }
                        description={conditions.join(" · ")}
                        actions={
                          <span className="text-sm text-ink-muted tabular-nums">
                            Answered {q.answered} of {q.asked} asked
                          </span>
                        }
                      />
                      <CardBody>
                        {q.type === "choice" ? (
                          <BarList
                            rows={[
                              ...q.options.map((o) => ({ label: o.label, value: o.count })),
                              // Answers naming an option you've since removed — shown so totals add up.
                              ...(q.removedOptionAnswers > 0
                                ? [{ label: "A removed option (ask them again)", value: q.removedOptionAnswers }]
                                : []),
                            ]}
                            total={q.answered}
                          />
                        ) : (
                          <TextAnswerList answers={q.textAnswers} />
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Card>
            <CardHeader
              title="Still waiting on"
              description={
                pendingHouseholds.length === 0
                  ? stats.responseRate.of === 0
                    ? "No households have been invited to RSVP events yet."
                    : "All invited households have replied."
                  : `${pendingHouseholds.length} ${plural(pendingHouseholds.length, "household")} yet to finish replying`
              }
              actions={
                pendingHouseholds.length > 0 && <form action={createDraftAction}>
                  <input type="hidden" name="kind" value="rsvp_reminder" />
                  <Button type="submit" variant="primary" size="sm">
                    Send a reminder
                  </Button>
                </form>
              }
            />
            <CardBody>
              {pendingHouseholds.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {stats.responseRate.of === 0
                    ? "Add guests to your guest list to start collecting RSVPs."
                    : "Everyone invited has replied."}
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {pendingHouseholds.map((h) => (
                    <li
                      key={h.householdId}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/guests/${h.householdId}`}
                            className="font-medium text-ink hover:text-brand hover:underline"
                          >
                            {h.label}
                          </Link>
                          <Badge tone="warn">
                            {h.state === "partial" ? "Partly replied" : "Awaiting reply"}
                          </Badge>
                        </div>
                        <p className="text-sm text-ink-muted">{h.missingSummary}</p>
                      </div>
                      <Link
                        href={`/admin/guests/${h.householdId}`}
                        className="text-sm font-medium text-brand hover:underline whitespace-nowrap"
                      >
                        View household
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
