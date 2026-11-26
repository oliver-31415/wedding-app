import type { Metadata } from "next";
import { deleteRunItemAction } from "@/app/admin/day-of/actions";
import { PrintButton, RunItemForm } from "@/components/admin/day-of/forms";
import { ItemJobs } from "@/components/admin/day-of/jobs";
import { DayOfSubNav } from "@/components/admin/day-of/sub-nav";
import { Card, CardBody, CardHeader, ConfirmButton, EmptyState, PageHeader, TextBlock } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { formatClock } from "@/lib/planning";
import { countUnassigned, describeJobCount, groupJobsByItem, helpersByJob } from "@/lib/run-sheet";
import { loadRunSheet } from "@/lib/run-sheet-data";

export const metadata: Metadata = { title: "Day of" };

export default async function RunSheetPage() {
  const { wedding } = await requireHost();
  const run = await loadRunSheet(wedding.id);
  const groups = groupJobsByItem(run.items, run.jobs);
  const items = groups.map((g) => g.item);
  const onJob = helpersByJob(run.assignments);
  // Names and roles only: this goes to the browser.
  const helperOptions = run.helpers.map((h) => ({ id: h.id, name: h.name, role: h.role }));
  const jobSummary = describeJobCount(run.jobs.length, countUnassigned(run.jobs, run.assignments));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Run sheet"
        description={
          <>
            The day, minute by minute{wedding.date ? ` — ${formatDateLong(wedding.date)}` : ""}. Add jobs to any item and who&rsquo;s
            doing them; each helper gets their own page. Print it or share it with your vendors and wedding party. Guests never see it.
            {jobSummary && <span className="text-ink"> {jobSummary}.</span>}
          </>
        }
        actions={items.length > 0 ? <PrintButton /> : undefined}
      />
      <DayOfSubNav current="/admin/day-of" />

      {items.length === 0 ? (
        <EmptyState title="Nothing on the run sheet yet" body="Add everything from hair and makeup to the last dance, with who’s responsible for each part." />
      ) : (
        <Card>
          <ol className="divide-y divide-line">
            {groups.map(({ item, jobs }) => (
              <li key={item.id} className="grid gap-1 px-5 py-4 break-inside-avoid sm:grid-cols-[5.5rem_1fr] sm:gap-3 print:grid-cols-[5.5rem_1fr] print:gap-3">
                <p className="font-medium text-ink tabular-nums">{item.time ? formatClock(item.time) : "—"}</p>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{item.title}</p>
                  {(item.location || item.who) && <p className="text-sm text-ink-muted">{[item.location, item.who].filter(Boolean).join(" · ")}</p>}
                  {item.notes && (
                    <div className="text-sm text-ink-muted">
                      <TextBlock text={item.notes} />
                    </div>
                  )}
                  <ItemJobs
                    item={{ id: item.id, time: item.time, title: item.title }}
                    jobs={jobs.map((j) => ({
                      id: j.id,
                      title: j.title,
                      notes: j.notes,
                      startTime: j.startTime,
                      endTime: j.endTime,
                      helperIds: onJob.get(j.id) ?? [],
                    }))}
                    helpers={helperOptions}
                  />
                  <details className="print:hidden">
                    <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Edit</summary>
                    <div className="mt-3 space-y-3">
                      <RunItemForm item={item} />
                      <form action={deleteRunItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmButton
                          confirm={`Delete “${item.title}”?`}
                          detail={jobs.length ? `Its ${jobs.length === 1 ? "1 job goes" : `${jobs.length} jobs go`} with it.` : undefined}
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card className="print:hidden">
        <CardHeader title="Add to the run sheet" description="Items sort themselves by time." />
        <CardBody>
          <RunItemForm />
        </CardBody>
      </Card>
    </div>
  );
}
