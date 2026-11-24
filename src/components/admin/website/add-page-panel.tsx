"use client";

import { useActionState } from "react";
import { addBuiltInPageAction, addCustomPageAction } from "@/app/admin/website/actions";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import type { PageTypeMeta } from "@/lib/pages";

export function AddPagePanel({ addable }: { addable: PageTypeMeta[] }) {
  const builtIn = addable.filter((m) => m.type !== "custom");
  const hasCustom = addable.some((m) => m.type === "custom");
  const [customState, customAction] = useActionState(addCustomPageAction, null);

  return (
    <Card>
      <CardHeader
        title="Add a page"
        description="Pages only appear on your guest site once you add them. New pages start blank."
      />
      <CardBody className="space-y-6">
        {builtIn.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {builtIn.map((meta) => (
              <li
                key={meta.type}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{meta.label}</p>
                  <p className="text-sm text-ink-muted">{meta.description}</p>
                </div>
                <form action={addBuiltInPageAction}>
                  <input type="hidden" name="type" value={meta.type} />
                  <SubmitButton variant="secondary" size="sm" pendingLabel="Adding…">
                    Add
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        {hasCustom && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-ink">Custom page</p>
              <p className="text-sm text-ink-muted">A blank page for anything else you want to share.</p>
            </div>
            <form action={customAction} className="max-w-lg space-y-3">
              <FormMessage state={customState} />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Field
                  label="Page title"
                  htmlFor="custom-page-title"
                  error={customState?.errors?.title}
                  className="flex-1"
                >
                  <Input
                    id="custom-page-title"
                    name="title"
                    placeholder="e.g. Dress code, Parking, Weekend notes"
                    invalid={!!customState?.errors?.title}
                  />
                </Field>
                <div className="sm:pt-6">
                  <SubmitButton variant="secondary" pendingLabel="Adding…">
                    Add custom page
                  </SubmitButton>
                </div>
              </div>
            </form>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
