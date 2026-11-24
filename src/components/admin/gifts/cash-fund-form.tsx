"use client";

import { useActionState, useState } from "react";
import { saveCashFundAction } from "@/app/admin/gifts/actions";
import {
  Checkbox,
  Field,
  FormMessage,
  Input,
  LinkButton,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import {
  MAX_DESCRIPTION,
  MAX_INSTRUCTIONS,
  MAX_NAME,
  MAX_URL,
  centsToInputValue,
} from "@/lib/gift-admin/helpers";

export type CashFundFormData = {
  id: string;
  name: string;
  description: string | null;
  goalCents: number | null;
  paymentInstructions: string | null;
  paymentUrl: string | null;
  hidden: boolean;
};

export function CashFundForm({
  fund,
  currency,
}: {
  fund?: CashFundFormData;
  currency: string;
}) {
  const [state, action] = useActionState(saveCashFundAction, null);

  const [name, setName] = useState(fund?.name ?? "");
  const [description, setDescription] = useState(fund?.description ?? "");
  const [goal, setGoal] = useState(centsToInputValue(fund?.goalCents));
  const [paymentInstructions, setPaymentInstructions] = useState(fund?.paymentInstructions ?? "");
  const [paymentUrl, setPaymentUrl] = useState(fund?.paymentUrl ?? "");
  const [hidden, setHidden] = useState(fund?.hidden ?? false);

  return (
    <form action={action} className="max-w-2xl space-y-5" noValidate>
      {fund && <input type="hidden" name="id" value={fund.id} />}
      <FormMessage state={state} />

      <Field label="Fund name" htmlFor="name" error={state?.errors?.name}>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          placeholder="e.g. Honeymoon in Japan"
          required
          invalid={!!state?.errors?.name}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        optional
        hint="Tell guests what you're saving towards."
        error={state?.errors?.description}
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DESCRIPTION}
          placeholder="e.g. Ramen, onsen and train rides across Kyoto and Tokyo."
          invalid={!!state?.errors?.description}
        />
      </Field>

      <Field
        label={`Goal (${currency})`}
        htmlFor="goal"
        optional
        hint="Leave blank if you prefer not to show a target."
        error={state?.errors?.goal}
      >
        <Input
          id="goal"
          name="goal"
          inputMode="decimal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. 5000"
          invalid={!!state?.errors?.goal}
        />
      </Field>

      <Field
        label="Payment instructions"
        htmlFor="paymentInstructions"
        optional
        hint="e.g. PayID: alex.sam@example.com, or BSB and account number. Money goes straight to you — never through this site."
        error={state?.errors?.paymentInstructions}
      >
        <Textarea
          id="paymentInstructions"
          name="paymentInstructions"
          rows={4}
          value={paymentInstructions}
          onChange={(e) => setPaymentInstructions(e.target.value)}
          maxLength={MAX_INSTRUCTIONS}
          placeholder={"PayID: alex.sam@example.com\nAccount name: Alex & Sam"}
          invalid={!!state?.errors?.paymentInstructions}
        />
      </Field>

      <Field
        label="Payment link"
        htmlFor="paymentUrl"
        optional
        hint="Optional web address such as a PayPal.me or Wise link."
        error={state?.errors?.paymentUrl}
      >
        <Input
          id="paymentUrl"
          name="paymentUrl"
          type="url"
          value={paymentUrl}
          onChange={(e) => setPaymentUrl(e.target.value)}
          maxLength={MAX_URL}
          placeholder="https://paypal.me/..."
          invalid={!!state?.errors?.paymentUrl}
        />
      </Field>

      <Checkbox
        name="hidden"
        checked={hidden}
        onChange={(e) => setHidden(e.target.checked)}
        label="Hide from guests"
        hint="Keep this cash fund off your guest gift list without deleting any contributions."
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel={fund ? "Saving…" : "Adding…"}>
          {fund ? "Save cash fund" : "Add cash fund"}
        </SubmitButton>
        <LinkButton variant="ghost" href="/admin/gifts/funds">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
