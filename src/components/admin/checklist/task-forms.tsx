"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTaskAction } from "@/app/admin/checklist/actions";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui";

type Host = { id: string; name: string };

function AssigneeSelect({ id, hosts, defaultValue }: { id: string; hosts: Host[]; defaultValue?: string | null }) {
  return (
    <Select id={id} name="assigneeId" defaultValue={defaultValue ?? ""}>
      <option value="">Anyone</option>
      {hosts.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </Select>
  );
}

export function AddTaskForm({ hosts }: { hosts: Host[] }) {
  const [state, action] = useActionState(saveTaskAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const e = state?.errors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
        <Field label="Task" htmlFor="task-title" error={e.title}>
          <Input id="task-title" name="title" placeholder="e.g. Book a tasting with the caterer" invalid={!!e.title} />
        </Field>
        <Field label="Due" htmlFor="task-due" optional error={e.dueDate}>
          <Input id="task-due" name="dueDate" type="date" invalid={!!e.dueDate} />
        </Field>
        <Field label="Who" htmlFor="task-who" error={e.assigneeId}>
          <AssigneeSelect id="task-who" hosts={hosts} />
        </Field>
        <SubmitButton>Add task</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function EditTaskForm({
  task,
  hosts,
}: {
  task: { id: string; title: string; dueDate: string | null; assigneeId: string | null; notes: string | null };
  hosts: Host[];
}) {
  const [state, action] = useActionState(saveTaskAction, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="max-w-2xl space-y-3">
      <input type="hidden" name="id" value={task.id} />
      <FormMessage state={state} />
      <Field label="Task" htmlFor={`t-${task.id}`} error={e.title}>
        <Input id={`t-${task.id}`} name="title" defaultValue={task.title} invalid={!!e.title} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Due" htmlFor={`d-${task.id}`} optional error={e.dueDate}>
          <Input id={`d-${task.id}`} name="dueDate" type="date" defaultValue={task.dueDate ?? ""} invalid={!!e.dueDate} />
        </Field>
        <Field label="Who" htmlFor={`w-${task.id}`} error={e.assigneeId}>
          <AssigneeSelect id={`w-${task.id}`} hosts={hosts} defaultValue={task.assigneeId} />
        </Field>
      </div>
      <Field label="Notes" htmlFor={`n-${task.id}`} optional>
        <Textarea id={`n-${task.id}`} name="notes" rows={2} defaultValue={task.notes ?? ""} />
      </Field>
      <SubmitButton variant="secondary" size="sm">
        Save task
      </SubmitButton>
    </form>
  );
}
