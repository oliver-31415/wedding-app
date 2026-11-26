"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteJobAction, saveJobAction } from "@/app/admin/day-of/job-actions";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmButton,
  Field,
  FormMessage,
  Input,
  Notice,
  SubmitButton,
  Textarea,
  TextBlock,
} from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { formatJobTime, helperLabel } from "@/lib/run-sheet";

export type JobRow = {
  id: string;
  title: string;
  notes: string | null;
  startTime: string | null;
  endTime: string | null;
  helperIds: string[];
};
/** Only what the form needs: never helpers' contact details or link tokens. */
export type HelperOption = { id: string; name: string; role: string | null };

const ADD_HELPER_HREF = "/admin/day-of/helpers/new?returnTo=%2Fadmin%2Fday-of";
const textButton = "text-sm text-ink-muted hover:text-ink";

/**
 * The jobs under one run sheet item: who's doing what, with add / edit /
 * delete. `jobs` come in order (`sortJobs`). Controls are hidden when printing.
 */
export function ItemJobs({
  item,
  jobs,
  helpers,
}: {
  item: { id: string; time: string | null; title: string };
  jobs: JobRow[];
  helpers: HelperOption[];
}) {
  // "new", a job id being edited, or null.
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const helperById = new Map(helpers.map((h) => [h.id, h]));
  const open = (id: string) => {
    setFlash(null);
    setEditing(id);
  };
  const done = (message?: string) => {
    setEditing(null);
    setFlash(message ?? null);
  };

  return (
    <div className="space-y-2 pt-1">
      {jobs.length > 0 && (
        <ul aria-label={`Jobs for ${item.title}`} className="divide-y divide-line rounded-lg border border-line bg-canvas">
          {jobs.map((job) => {
            const time = formatJobTime(job);
            const names = job.helperIds
              .map((id) => helperById.get(id))
              .filter((h) => !!h)
              .map(helperLabel);
            return (
              <li key={job.id} className="space-y-1 px-3 py-2.5 break-inside-avoid">
                {editing === job.id ? (
                  <div className="space-y-3">
                    <JobForm item={item} job={job} helpers={helpers} onDone={done} />
                    <form action={deleteJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <ConfirmButton
                        confirm={`Delete the job “${job.title}”?`}
                        detail={
                          names.length
                            ? `It comes off ${names.length === 1 ? "1 helper's page" : `${names.length} helpers' pages`}.`
                            : undefined
                        }
                      >
                        Delete job
                      </ConfirmButton>
                    </form>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm text-ink">
                        {time && <span className="block text-ink-muted tabular-nums whitespace-nowrap sm:mr-2 sm:inline">{time}</span>}
                        <span className="font-medium">{job.title}</span>
                      </p>
                      <button type="button" className={`${textButton} shrink-0 print:hidden`} onClick={() => open(job.id)} disabled={editing !== null}>
                        Edit
                      </button>
                    </div>
                    <TextBlock text={job.notes} className="space-y-2 text-sm text-ink-muted" />
                    {names.length ? <p className="text-sm text-ink-muted">{names.join(", ")}</p> : <Badge tone="warn">No one yet</Badge>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {flash && (
        <div className="print:hidden">
          <Notice tone="good">{flash}</Notice>
        </div>
      )}

      {editing === "new" ? (
        <div className="rounded-lg border border-line bg-canvas p-3">
          <JobForm item={item} helpers={helpers} onDone={done} />
        </div>
      ) : (
        <button type="button" className={`${textButton} print:hidden`} onClick={() => open("new")} disabled={editing !== null}>
          + Add job
        </button>
      )}
    </div>
  );
}

function JobForm({
  item,
  job,
  helpers,
  onDone,
}: {
  item: { id: string; time: string | null };
  job?: JobRow;
  helpers: HelperOption[];
  onDone: (message?: string) => void;
}) {
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveJobAction(prev, formData);
    if (result?.ok) onDone(result.message);
    return result;
  }, null);
  // Controlled, so nothing is lost when the action returns an error. A new job starts at the item's time.
  const [title, setTitle] = useState(job?.title ?? "");
  const [startTime, setStartTime] = useState(job ? (job.startTime ?? "") : (item.time ?? ""));
  const [endTime, setEndTime] = useState(job?.endTime ?? "");
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [chosen, setChosen] = useState<Set<string>>(new Set(job?.helperIds ?? []));
  const idp = job ? `job-${job.id}` : `job-new-${item.id}`;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="itemId" value={item.id} />
      {job && <input type="hidden" name="jobId" value={job.id} />}
      <p className="text-sm font-semibold text-ink">{job ? "Edit job" : "Add a job"}</p>
      <FormMessage state={state} />

      <Field label="What needs doing" htmlFor={`${idp}-title`} error={state?.errors?.title}>
        <Input
          id={`${idp}-title`}
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Hand out the order of service"
          invalid={!!state?.errors?.title}
          required
          autoFocus
        />
      </Field>

      <div className="grid gap-3 sm:max-w-sm sm:grid-cols-2">
        <Field label="Start" htmlFor={`${idp}-start`} optional error={state?.errors?.startTime}>
          <Input
            id={`${idp}-start`}
            name="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            invalid={!!state?.errors?.startTime}
          />
        </Field>
        <Field label="End" htmlFor={`${idp}-end`} optional error={state?.errors?.endTime}>
          <Input
            id={`${idp}-end`}
            name="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            invalid={!!state?.errors?.endTime}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor={`${idp}-notes`} optional hint="Where things are, who to ask, anything they need to bring.">
        <Textarea id={`${idp}-notes`} name="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">
          Who&rsquo;s doing it<span className="ml-1.5 font-normal text-ink-faint">Optional</span>
        </legend>
        {helpers.length === 0 ? (
          <p className="text-sm text-ink-muted">
            You haven&rsquo;t added any helpers yet.{" "}
            <Link href={ADD_HELPER_HREF} className="font-medium text-brand hover:underline">
              Add a helper
            </Link>
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {helpers.map((h) => (
                <Checkbox
                  key={h.id}
                  name="helperIds"
                  value={h.id}
                  checked={chosen.has(h.id)}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(h.id);
                    else next.delete(h.id);
                    setChosen(next);
                  }}
                  label={h.name}
                  hint={h.role ?? undefined}
                />
              ))}
            </div>
            <p className="pt-1 text-sm">
              <Link href={ADD_HELPER_HREF} className="text-brand hover:underline">
                Add someone new
              </Link>
            </p>
          </>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton size="sm" pendingLabel="Saving…">
          {job ? "Save job" : "Add job"}
        </SubmitButton>
        <Button size="sm" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
