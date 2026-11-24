"use client";

import { useActionState, useState } from "react";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, Notice, Select, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { CopyButton } from "@/components/ui";
import { currencyOptions, timeZoneOptions } from "./helpers";

type WeddingGeneralProps = {
  partnerOne: string;
  partnerTwo: string;
  date: string | null;
  locationName: string | null;
  timeZone: string;
  currency: string;
  slug: string;
};

export function GeneralDetailsForm({
  wedding,
  action,
}: {
  wedding: WeddingGeneralProps;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [partnerOne, setPartnerOne] = useState(wedding.partnerOne);
  const [partnerTwo, setPartnerTwo] = useState(wedding.partnerTwo);
  const [date, setDate] = useState(wedding.date ?? "");
  const [locationName, setLocationName] = useState(wedding.locationName ?? "");
  const [timeZone, setTimeZone] = useState(wedding.timeZone);
  const [currency, setCurrency] = useState(wedding.currency);

  const tzOpts = timeZoneOptions(wedding.timeZone);
  const currOpts = currencyOptions(wedding.currency);

  return (
    <Card>
      <CardHeader
        title="Wedding details"
        description="Shown on your wedding website, emails and gift list."
      />
      <CardBody>
        <form action={formAction} className="max-w-2xl space-y-5" noValidate>
          <FormMessage state={state} />
          <Field label="Partner one" htmlFor="partnerOne" error={state?.errors?.partnerOne}>
            <Input
              id="partnerOne"
              name="partnerOne"
              value={partnerOne}
              onChange={(e) => setPartnerOne(e.target.value)}
              invalid={!!state?.errors?.partnerOne}
              required
            />
          </Field>

          <Field label="Partner two" htmlFor="partnerTwo" error={state?.errors?.partnerTwo}>
            <Input
              id="partnerTwo"
              name="partnerTwo"
              value={partnerTwo}
              onChange={(e) => setPartnerTwo(e.target.value)}
              invalid={!!state?.errors?.partnerTwo}
              required
            />
          </Field>

          <Field
            label="Wedding date"
            htmlFor="date"
            optional
            hint="Leave blank if you haven't set a date yet."
            error={state?.errors?.date}
          >
            <Input
              id="date"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              invalid={!!state?.errors?.date}
            />
          </Field>

          <Field label="Location" htmlFor="locationName" optional error={state?.errors?.locationName}>
            <Input
              id="locationName"
              name="locationName"
              placeholder="Bowral, NSW"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              invalid={!!state?.errors?.locationName}
            />
          </Field>

          <Field
            label="Time zone"
            htmlFor="timeZone"
            hint="Used for event times and your RSVP deadline."
            error={state?.errors?.timeZone}
          >
            <Select
              id="timeZone"
              name="timeZone"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              invalid={!!state?.errors?.timeZone}
            >
              {tzOpts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Currency"
            htmlFor="currency"
            hint="Used for gift prices and cash funds."
            error={state?.errors?.currency}
          >
            <Select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              invalid={!!state?.errors?.currency}
            >
              {currOpts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="pt-1">
            <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function WebAddressCard({
  slug,
  siteBaseUrl,
  isOwner,
  action,
}: {
  slug: string;
  siteBaseUrl: string;
  isOwner: boolean;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [value, setValue] = useState(slug);
  const currentUrl = `${siteBaseUrl}/w/${slug}`;

  return (
    <Card>
      <CardHeader
        title="Web address"
        description="The link guests use to visit your wedding website."
      />
      <CardBody className="max-w-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-sunken px-4 py-3">
          <span className="break-all text-sm font-medium text-ink">{currentUrl}</span>
          <CopyButton text={currentUrl} label="Copy link" />
        </div>

        {isOwner ? (
          <form action={formAction} className="space-y-4" noValidate>
            <FormMessage state={state} />
            <Notice tone="warn">
              Changing your web address will stop any old links you&apos;ve already shared with guests from working.
            </Notice>
            <Field
              label="Site slug"
              htmlFor="slug"
              hint="Lowercase letters, numbers and hyphens only (3–60 characters)."
              error={state?.errors?.slug}
            >
              <div className="flex items-center">
                <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-line-strong bg-sunken px-3 text-sm text-ink-muted">
                  /w/
                </span>
                <Input
                  id="slug"
                  name="slug"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  invalid={!!state?.errors?.slug}
                  className="rounded-l-none"
                  required
                />
              </div>
            </Field>
            <SubmitButton pendingLabel="Saving…">Save web address</SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">Only the wedding owner can change the web address.</p>
        )}
      </CardBody>
    </Card>
  );
}
