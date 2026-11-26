import Link from "next/link";
import { deleteHelperAction, reorderHelperAction } from "@/app/admin/day-of/helpers/actions";
import { EmailAllHelpersButton, EmailHelperButton } from "@/components/admin/day-of/email-helpers";
import { DayOfSubNav } from "@/components/admin/day-of/sub-nav";
import {
  Card,
  CardHeader,
  ConfirmButton,
  CopyButton,
  EmptyState,
  LinkButton,
  PageHeader,
  ReorderButtons,
} from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { formatClock } from "@/lib/planning";
import { formatJobTime, groupHelperJobs } from "@/lib/run-sheet";
import { helperUrl, loadRunSheet } from "@/lib/run-sheet-data";

export default async function HelpersPage() {
  const { wedding } = await requireHost();
  const { items, jobs, helpers, assignments } = await loadRunSheet(wedding.id);

  const jobCount = (helperId: string) => assignments.filter((a) => a.helperId === helperId).length;
  const emailable = helpers.filter((h) => h.email && jobCount(h.id) > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Helpers"
        description="Helpers are the people doing jobs on the day. Each gets a private page with their jobs, times and places."
        actions={
          <LinkButton href="/admin/day-of/helpers/new" variant="primary" size="sm">
            Add helper
          </LinkButton>
        }
      />

      <DayOfSubNav current="/admin/day-of/helpers" />

      {helpers.length === 0 ? (
        <EmptyState
          title="No helpers yet"
          body="Add your wedding party, family and friends who are helping out. Then put them on jobs on your run sheet, and send each of them a link to their own page."
          action={
            <LinkButton href="/admin/day-of/helpers/new" variant="primary">
              Add helper
            </LinkButton>
          }
        />
      ) : (
        <>
          {emailable > 0 && (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
              <p className="text-ink-muted sm:pt-1.5">
                Send each helper a link to their page. It stays up to date when you change their jobs.
              </p>
              <EmailAllHelpersButton count={emailable} />
            </div>
          )}

          <Card>
            <CardHeader title="Helpers" description="Their page only shows their own jobs, and who else is on each one." />
            <ul className="divide-y divide-line">
              {helpers.map((helper, i) => {
                const groups = groupHelperJobs(helper.id, items, jobs, assignments);
                const count = jobCount(helper.id);
                const link = helperUrl(helper.token);
                const contact = [helper.email, helper.phone].filter(Boolean).join(" · ");
                return (
                  <li key={helper.id} className="space-y-4 px-5 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-medium text-ink">
                          {helper.name}
                          {helper.role && <span className="font-normal text-ink-muted"> · {helper.role}</span>}
                        </p>
                        {contact && <p className="text-sm break-all text-ink-muted">{contact}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <ReorderButtons
                          id={helper.id}
                          action={reorderHelperAction}
                          isFirst={i === 0}
                          isLast={i === helpers.length - 1}
                          label={helper.name}
                        />
                        <LinkButton href={`/admin/day-of/helpers/${helper.id}`} variant="secondary" size="sm">
                          Edit
                        </LinkButton>
                        <form action={deleteHelperAction}>
                          <input type="hidden" name="id" value={helper.id} />
                          <ConfirmButton
                            confirm={`Delete ${helper.name}?`}
                            detail={`${count ? `Taken off ${count === 1 ? "1 job" : `${count} jobs`}, and their` : "Their"} page link will stop working.`}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </div>

                    {groups.length === 0 ? (
                      <p className="text-sm text-ink-muted">Not on any jobs yet. Add them to a job on the <Link href="/admin/day-of" className="text-brand hover:underline">run sheet</Link>.</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {groups.flatMap(({ item, jobs: theirs }) =>
                          theirs.map((job) => (
                            <li key={job.id} className="flex flex-col sm:flex-row sm:gap-3">
                              <span className="shrink-0 text-ink-muted tabular-nums sm:w-40">
                                {formatJobTime(job) ?? (item.time ? formatClock(item.time) : "No set time")}
                              </span>
                              <span className="min-w-0">
                                <span className="text-ink-muted">{item.title}</span>
                                <span className="text-ink-faint"> · </span>
                                <span className="text-ink">{job.title}</span>
                              </span>
                            </li>
                          )),
                        )}
                      </ul>
                    )}

                    <div className="flex flex-col gap-3 rounded-lg border border-line bg-canvas p-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-ink-muted">Their page</p>
                        <p className="truncate font-mono text-xs text-ink">{link}</p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <CopyButton text={link} label="Copy link" />
                          <a
                            href={`/helper/${helper.token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 text-sm font-medium text-brand hover:underline"
                          >
                            Open ↗
                          </a>
                        </div>
                      </div>
                      {helper.email && (
                        <div className="shrink-0 sm:max-w-xs">
                          <EmailHelperButton helperId={helper.id} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
