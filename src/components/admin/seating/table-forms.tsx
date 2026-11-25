"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTableAction } from "@/app/admin/seating/actions";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";

export function TableForm({ table, nextNumber }: { table?: { id: string; name: string; capacity: number; notes: string | null }; nextNumber?: number }) {
  const [state, action] = useActionState(saveTableAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !table) ref.current?.reset();
  }, [state, table]);
  const e = state?.errors ?? {};
  const key = table?.id ?? "new";
  return (
    <form ref={ref} action={action} className="space-y-3">
      {table && <input type="hidden" name="id" value={table.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_1fr_auto] sm:items-end">
        <Field label="Table" htmlFor={`tn-${key}`} error={e.name}>
          <Input id={`tn-${key}`} name="name" defaultValue={table?.name ?? ""} placeholder={nextNumber ? `e.g. Table ${nextNumber}` : undefined} invalid={!!e.name} />
        </Field>
        <Field label="Seats" htmlFor={`tc-${key}`} error={e.capacity}>
          <Input id={`tc-${key}`} name="capacity" type="number" min={1} max={100} defaultValue={table?.capacity ?? 10} invalid={!!e.capacity} />
        </Field>
        <Field label="Note" htmlFor={`tx-${key}`} optional>
          <Input id={`tx-${key}`} name="notes" defaultValue={table?.notes ?? ""} placeholder="e.g. Near the dance floor" />
        </Field>
        <SubmitButton variant={table ? "secondary" : "primary"}>{table ? "Save table" : "Add table"}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
