"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addPaymentAction,
  saveBudgetTotalAction,
  saveCategoryAction,
  saveVendorAction,
} from "@/app/admin/budget/actions";
import {
  Checkbox,
  Field,
  FormMessage,
  Input,
  LinkButton,
  MoneyInput,
  RadioGroup,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";

const centsToInput = (cents: number | null | undefined) => (cents === null || cents === undefined ? "" : (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2));

/** Clears a form after a successful add so the next one can be typed straight away. */
function useResetOnSuccess(state: { ok?: boolean } | null) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function BudgetTotalForm({ budgetCents }: { budgetCents: number | null }) {
  const [state, action] = useActionState(saveBudgetTotalAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Total budget" htmlFor="budget" error={state?.errors?.budget} className="w-48">
        <MoneyInput id="budget" name="budget" defaultValue={centsToInput(budgetCents)} placeholder="40,000" invalid={!!state?.errors?.budget} />
      </Field>
      <SubmitButton variant="secondary">Save budget</SubmitButton>
      <div className="basis-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddCategoryForm() {
  const [state, action] = useActionState(saveCategoryAction, null);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Category" htmlFor="new-category" error={state?.errors?.name} className="min-w-48 flex-1">
          <Input id="new-category" name="name" placeholder="e.g. Venue" invalid={!!state?.errors?.name} />
        </Field>
        <Field label="Estimate" htmlFor="new-estimate" optional error={state?.errors?.estimate} className="w-40">
          <MoneyInput id="new-estimate" name="estimate" invalid={!!state?.errors?.estimate} />
        </Field>
        <SubmitButton>Add category</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function EditCategoryForm({ category }: { category: { id: string; name: string; estimateCents: number | null } }) {
  const [state, action] = useActionState(saveCategoryAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={category.id} />
      <Field label="Name" htmlFor={`cat-${category.id}`} error={state?.errors?.name} className="min-w-40 flex-1">
        <Input id={`cat-${category.id}`} name="name" defaultValue={category.name} invalid={!!state?.errors?.name} />
      </Field>
      <Field label="Estimate" htmlFor={`est-${category.id}`} error={state?.errors?.estimate} className="w-36">
        <MoneyInput id={`est-${category.id}`} name="estimate" defaultValue={centsToInput(category.estimateCents)} invalid={!!state?.errors?.estimate} />
      </Field>
      <SubmitButton variant="secondary" size="sm" className="mb-1">
        Save
      </SubmitButton>
    </form>
  );
}

export type EditableVendor = {
  id: string;
  name: string;
  categoryId: string | null;
  status: "considering" | "booked";
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  quoteCents: number | null;
  notes: string | null;
};

export function VendorForm({ vendor, categories }: { vendor?: EditableVendor; categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState(saveVendorAction, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="max-w-2xl space-y-5">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <FormMessage state={state} />
      <Field label="Vendor name" htmlFor="vendor-name" error={e.name}>
        <Input id="vendor-name" name="name" defaultValue={vendor?.name} placeholder="e.g. Cedar & Vine Catering" invalid={!!e.name} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget category" htmlFor="vendor-category" optional error={e.categoryId} hint={categories.length === 0 ? "Add categories on the Budget tab to group costs." : undefined}>
          <Select id="vendor-category" name="categoryId" defaultValue={vendor?.categoryId ?? ""}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quote" htmlFor="vendor-quote" optional error={e.quote} hint="The total price for the booking.">
          <MoneyInput id="vendor-quote" name="quote" defaultValue={centsToInput(vendor?.quoteCents)} invalid={!!e.quote} />
        </Field>
      </div>
      <RadioGroup
        name="status"
        legend="Status"
        defaultValue={vendor?.status ?? "considering"}
        options={[
          { value: "considering", label: "Considering", hint: "Comparing quotes. Not counted in your budget yet." },
          { value: "booked", label: "Booked", hint: "Counted in your budget, with its payments on your schedule." },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact person" htmlFor="vendor-contact" optional>
          <Input id="vendor-contact" name="contactName" defaultValue={vendor?.contactName ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="vendor-phone" optional>
          <Input id="vendor-phone" name="phone" type="tel" defaultValue={vendor?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="vendor-email" optional error={e.email}>
          <Input id="vendor-email" name="email" type="email" defaultValue={vendor?.email ?? ""} invalid={!!e.email} />
        </Field>
        <Field label="Website" htmlFor="vendor-website" optional error={e.website}>
          <Input id="vendor-website" name="website" defaultValue={vendor?.website ?? ""} placeholder="example.com.au" invalid={!!e.website} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="vendor-notes" optional hint="What’s included, contract details, questions to ask.">
        <Textarea id="vendor-notes" name="notes" defaultValue={vendor?.notes ?? ""} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>{vendor ? "Save vendor" : "Add vendor"}</SubmitButton>
        <LinkButton href="/admin/budget/vendors" variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}

export function AddPaymentForm({ vendorId }: { vendorId: string }) {
  const [state, action] = useActionState(addPaymentAction, null);
  const ref = useResetOnSuccess(state);
  const e = state?.errors ?? {};
  return (
    <form ref={ref} action={action} className="space-y-4">
      <input type="hidden" name="vendorId" value={vendorId} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Payment" htmlFor="pay-label" error={e.label}>
          <Input id="pay-label" name="label" placeholder="e.g. Deposit, Final balance" invalid={!!e.label} />
        </Field>
        <Field label="Amount" htmlFor="pay-amount" error={e.amount}>
          <MoneyInput id="pay-amount" name="amount" invalid={!!e.amount} />
        </Field>
        <Field label="Due" htmlFor="pay-due" optional error={e.dueDate}>
          <Input id="pay-due" name="dueDate" type="date" invalid={!!e.dueDate} />
        </Field>
      </div>
      <Checkbox name="alreadyPaid" label="Already paid" />
      <SubmitButton variant="secondary">Add payment</SubmitButton>
    </form>
  );
}
