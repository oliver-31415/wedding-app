"use client";

import { useActionState, useState } from "react";
import { saveHelperAction } from "@/app/admin/day-of/helpers/actions";
import { Field, FormMessage, Input, LinkButton, Select, SubmitButton } from "@/components/ui";

export type EditableHelper = { id: string; name: string; role: string | null; email: string | null; phone: string | null };
export type GuestOption = { id: string; name: string; email: string | null; phone: string | null };

export function HelperForm({
  helper,
  guests,
  returnTo,
}: {
  helper?: EditableHelper;
  guests: GuestOption[];
  returnTo: string;
}) {
  const [state, action] = useActionState(saveHelperAction, null);
  const [guestId, setGuestId] = useState("");
  const [name, setName] = useState(helper?.name ?? "");
  const [role, setRole] = useState(helper?.role ?? "");
  const [email, setEmail] = useState(helper?.email ?? "");
  const [phone, setPhone] = useState(helper?.phone ?? "");

  const fillFrom = (id: string) => {
    setGuestId(id);
    const g = guests.find((x) => x.id === id);
    if (!g) return;
    setName(g.name);
    setEmail(g.email ?? "");
    setPhone(g.phone ?? "");
  };

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {helper && <input type="hidden" name="helperId" value={helper.id} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormMessage state={state} />

      {guests.length > 0 && (
        <Field
          label="Fill in from your guest list"
          htmlFor="helper-guest"
          optional
          hint="Copies their name, email and phone into the fields below. You can still change them."
        >
          <Select id="helper-guest" value={guestId} onChange={(e) => fillFrom(e.target.value)}>
            <option value="">Choose a guest…</option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Name" htmlFor="helper-name" error={state?.errors?.name}>
        <Input
          id="helper-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jess Taylor"
          invalid={!!state?.errors?.name}
          required
        />
      </Field>

      <Field label="Role" htmlFor="helper-role" optional hint="Shown next to their name, so others on a job know who's who.">
        <Input
          id="helper-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Bridesmaid, MC, Sam's uncle"
        />
      </Field>

      <Field
        label="Email"
        htmlFor="helper-email"
        optional
        error={state?.errors?.email}
        hint="So you can email them a link to their jobs. Other helpers never see it."
      >
        <Input
          id="helper-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!state?.errors?.email}
        />
      </Field>

      <Field label="Phone" htmlFor="helper-phone" optional hint="For your run sheet. Other helpers never see it.">
        <Input id="helper-phone" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton pendingLabel="Saving…">{helper ? "Save helper" : "Add helper"}</SubmitButton>
        <LinkButton href={returnTo} variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
