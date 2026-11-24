"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { suggestWeddingSlug } from "./validation";

export function OnboardingForm({
  action,
  siteBaseUrl,
  atRoot,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  siteBaseUrl: string;
  /** The new wedding will be shown at the root of this server's domain. */
  atRoot: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [partnerOne, setPartnerOne] = useState("");
  const [partnerTwo, setPartnerTwo] = useState("");
  const [date, setDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const handlePartnerOne = (value: string) => {
    setPartnerOne(value);
    if (!slugEdited) setSlug(suggestWeddingSlug(value, partnerTwo));
  };

  const handlePartnerTwo = (value: string) => {
    setPartnerTwo(value);
    if (!slugEdited) setSlug(suggestWeddingSlug(partnerOne, value));
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Partner one" htmlFor="partnerOne" error={state?.errors?.partnerOne}>
          <Input
            id="partnerOne"
            name="partnerOne"
            type="text"
            placeholder="Alex"
            value={partnerOne}
            onChange={(e) => handlePartnerOne(e.target.value)}
            invalid={!!state?.errors?.partnerOne}
            required
          />
        </Field>
        <Field label="Partner two" htmlFor="partnerTwo" error={state?.errors?.partnerTwo}>
          <Input
            id="partnerTwo"
            name="partnerTwo"
            type="text"
            placeholder="Sam"
            value={partnerTwo}
            onChange={(e) => handlePartnerTwo(e.target.value)}
            invalid={!!state?.errors?.partnerTwo}
            required
          />
        </Field>
      </div>

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
          type="text"
          placeholder="Bowral, NSW"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          invalid={!!state?.errors?.locationName}
        />
      </Field>

      {atRoot && !state?.errors?.slug ? (
        <div className="space-y-1">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm font-medium text-ink">Web address</p>
          <p className="break-all text-sm text-ink-muted">
            Your site will live at <span className="font-medium text-ink">{siteBaseUrl}</span>
          </p>
        </div>
      ) : (
      <Field
        label="Web address"
        htmlFor="slug"
        hint={
          <span className="break-all">
            Your site will live at{" "}
            <span className="font-medium text-ink">
              {siteBaseUrl}/w/{slug || "alex-and-sam"}
            </span>
            . Lowercase letters, numbers and hyphens only.
          </span>
        }
        error={state?.errors?.slug}
      >
        <div className="flex items-center">
          <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-line-strong bg-sunken px-3 text-sm text-ink-muted">
            /w/
          </span>
          <Input
            id="slug"
            name="slug"
            type="text"
            placeholder="alex-and-sam"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            invalid={!!state?.errors?.slug}
            className="rounded-l-none"
            required
          />
        </div>
      </Field>
      )}

      <SubmitButton className="w-full" pendingLabel="Creating your wedding…">
        Create wedding
      </SubmitButton>
    </form>
  );
}
