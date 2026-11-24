"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { submitContactDetailsAction } from "@/app/contact/[token]/actions";
import { Button, Card, CardBody, Field, FormMessage, Input, Textarea } from "@/components/ui";
import type { ContactAddress } from "@/db/schema";
import { type HouseholdMember, MAX_CONTACT_PEOPLE } from "@/lib/contacts";

const ADDRESS_INPUTS: { name: keyof ContactAddress; label: string; autoComplete: string; wide?: boolean }[] = [
  { name: "addressLine1", label: "Street address", autoComplete: "address-line1", wide: true },
  { name: "addressLine2", label: "Unit, building, etc.", autoComplete: "address-line2", wide: true },
  { name: "city", label: "Suburb or town", autoComplete: "address-level2" },
  { name: "region", label: "State", autoComplete: "address-level1" },
  { name: "postcode", label: "Postcode", autoComplete: "postal-code" },
  { name: "country", label: "Country", autoComplete: "country-name" },
];

/**
 * The guest-facing contact details form. Shared link: the guest types their
 * own name (plus anyone else in their household). Personal link: the
 * household's people are listed and only their details are asked for.
 */
export function ContactForm({
  token,
  personal,
}: {
  token: string;
  personal?: { label: string; members: HouseholdMember[]; address: ContactAddress };
}) {
  const id = useId();
  const [state, action, pending] = useActionState(submitContactDetailsAction, null);
  const [rows, setRows] = useState(1);
  const err = (name: string) => state?.errors?.[name];

  if (state?.ok) {
    return (
      <Card>
        <CardBody className="space-y-2 p-8 text-center">
          <p className="font-serif text-2xl text-ink">Thank you!</p>
          <p className="text-sm text-ink-muted">
            {personal ? "Your details are saved." : "Your details have been sent to the couple."} You can close this page.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <form
      // Submitted by hand rather than with `action=`, so a reply that needs
      // fixing keeps everything the guest typed (form actions reset the fields).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-5"
      noValidate
    >
      <input type="hidden" name="token" value={token} />
      {/* Bots fill every field; people never see this one. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormMessage state={state} />

      {personal ? (
        <Card>
          <CardBody className="space-y-5">
            <p className="text-sm font-medium text-ink">Hi {personal.label}!</p>
            {personal.members.map((m) => (
              <fieldset key={m.id} className="space-y-3 border-t border-line pt-4 first-of-type:border-0 first-of-type:pt-0">
                <legend className="text-sm font-medium text-ink">
                  {m.firstName} {m.lastName}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Email" htmlFor={`${id}-${m.id}-email`} optional error={err(`guest.${m.id}.email`)}>
                    <Input
                      id={`${id}-${m.id}-email`}
                      name={`guest.${m.id}.email`}
                      type="email"
                      autoComplete="off"
                      defaultValue={m.email ?? ""}
                      invalid={!!err(`guest.${m.id}.email`)}
                    />
                  </Field>
                  <Field label="Mobile" htmlFor={`${id}-${m.id}-phone`} optional error={err(`guest.${m.id}.phone`)}>
                    <Input
                      id={`${id}-${m.id}-phone`}
                      name={`guest.${m.id}.phone`}
                      type="tel"
                      autoComplete="off"
                      defaultValue={m.phone ?? ""}
                      invalid={!!err(`guest.${m.id}.phone`)}
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-5">
            {Array.from({ length: rows }, (_, i) => (
              <fieldset key={i} className="space-y-3 border-t border-line pt-4 first-of-type:border-0 first-of-type:pt-0">
                <legend className="text-sm font-medium text-ink">{i === 0 ? "You" : `Someone else in your household`}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" htmlFor={`${id}-${i}-first`} error={err(`people.${i}.firstName`)}>
                    <Input
                      id={`${id}-${i}-first`}
                      name={`people.${i}.firstName`}
                      autoComplete={i === 0 ? "given-name" : "off"}
                      required={i === 0}
                      invalid={!!err(`people.${i}.firstName`)}
                    />
                  </Field>
                  <Field label="Last name" htmlFor={`${id}-${i}-last`} error={err(`people.${i}.lastName`)}>
                    <Input
                      id={`${id}-${i}-last`}
                      name={`people.${i}.lastName`}
                      autoComplete={i === 0 ? "family-name" : "off"}
                      required={i === 0}
                      invalid={!!err(`people.${i}.lastName`)}
                    />
                  </Field>
                  <Field label="Email" htmlFor={`${id}-${i}-email`} optional error={err(`people.${i}.email`)}>
                    <Input
                      id={`${id}-${i}-email`}
                      name={`people.${i}.email`}
                      type="email"
                      autoComplete={i === 0 ? "email" : "off"}
                      invalid={!!err(`people.${i}.email`)}
                    />
                  </Field>
                  <Field label="Mobile" htmlFor={`${id}-${i}-phone`} optional error={err(`people.${i}.phone`)}>
                    <Input
                      id={`${id}-${i}-phone`}
                      name={`people.${i}.phone`}
                      type="tel"
                      autoComplete={i === 0 ? "tel" : "off"}
                      invalid={!!err(`people.${i}.phone`)}
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
            {rows < MAX_CONTACT_PEOPLE && (
              <Button variant="secondary" size="sm" onClick={() => setRows((r) => r + 1)}>
                Add someone else in your household
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-ink">
            Postal address <span className="font-normal text-ink-faint">Optional</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADDRESS_INPUTS.map((f) => (
              <div key={f.name} className={f.wide ? "sm:col-span-2" : undefined}>
                <Field label={f.label} htmlFor={`${id}-${f.name}`}>
                  <Input
                    id={`${id}-${f.name}`}
                    name={f.name}
                    autoComplete={f.autoComplete}
                    defaultValue={personal?.address[f.name] ?? ""}
                  />
                </Field>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Field label="Anything else?" htmlFor={`${id}-note`} optional>
        <Textarea id={`${id}-note`} name="note" rows={2} maxLength={500} />
      </Field>

      <Button type="submit" variant="primary" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : personal ? "Save my details" : "Send my details"}
      </Button>
    </form>
  );
}
