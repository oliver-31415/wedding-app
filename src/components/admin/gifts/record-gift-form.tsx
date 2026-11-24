"use client";

import { useActionState, useState } from "react";
import { recordOfflineGiftAction } from "@/app/admin/gifts/actions";
import {
  Field,
  FormMessage,
  Input,
  Notice,
  RadioGroup,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { GiftPicture } from "@/components/site/gifts/gift-picture";
import type { ActionState } from "@/lib/forms";
import { MAX_MESSAGE, MAX_NAME, MAX_QUANTITY, MIN_QUANTITY } from "@/lib/gift-admin/helpers";

export function RecordGiftForm({
  items,
  funds,
  currency,
}: {
  items: Array<{ id: string; name: string; imageUrl?: string | null }>;
  funds: Array<{ id: string; name: string }>;
  currency: string;
}) {
  const defaultKind: "fund" | "item" = funds.length > 0 ? "fund" : "item";
  const [kind, setKind] = useState<"fund" | "item">(defaultKind);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [fundId, setFundId] = useState(funds[0]?.id ?? "");
  const [giverName, setGiverName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");

  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await recordOfflineGiftAction(prev, formData);
    if (res?.ok) {
      setGiverName("");
      setAmount("");
      setQuantity("1");
      setMessage("");
    }
    return res;
  }, null);

  if (items.length === 0 && funds.length === 0) {
    return (
      <Notice tone="info">
        Add a gift item or cash fund first before recording an offline gift.
      </Notice>
    );
  }

  const options = [
    ...(funds.length > 0
      ? [{ value: "fund", label: "Cash fund", hint: "Recorded as received straight away." }]
      : []),
    ...(items.length > 0
      ? [{ value: "item", label: "Gift item", hint: "Counts towards the item's claimed quantity." }]
      : []),
  ];

  const selectedItem = items.find((i) => i.id === itemId);

  return (
    <form action={action} className="max-w-2xl space-y-5" noValidate>
      <FormMessage state={state} />

      {options.length > 1 ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Gift type</p>
          <RadioGroup
            name="kind"
            defaultValue={kind}
            options={options}
            onChange={(v) => setKind(v as "fund" | "item")}
          />
        </div>
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}

      {kind === "fund" ? (
        <Field label="Cash fund" htmlFor="record-fundId" error={state?.errors?.fundId}>
          <Select
            id="record-fundId"
            name="fundId"
            value={fundId}
            onChange={(e) => setFundId(e.target.value)}
            invalid={!!state?.errors?.fundId}
          >
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Gift item" htmlFor="record-itemId" error={state?.errors?.itemId}>
          <div className="flex items-center gap-3">
            {selectedItem?.imageUrl && (
              <GiftPicture src={selectedItem.imageUrl} alt="" size="sm" />
            )}
            <Select
              id="record-itemId"
              name="itemId"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              invalid={!!state?.errors?.itemId}
              className="flex-1"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      )}

      <Field label="Giver's name" htmlFor="record-giverName" error={state?.errors?.giverName}>
        <Input
          id="record-giverName"
          name="giverName"
          value={giverName}
          onChange={(e) => setGiverName(e.target.value)}
          maxLength={MAX_NAME}
          placeholder="e.g. Aunty Margaret & Uncle John"
          required
          invalid={!!state?.errors?.giverName}
        />
      </Field>

      {kind === "fund" ? (
        <Field label={`Amount (${currency})`} htmlFor="record-amount" error={state?.errors?.amount}>
          <Input
            id="record-amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 200"
            required
            invalid={!!state?.errors?.amount}
          />
        </Field>
      ) : (
        <Field label="Quantity" htmlFor="record-quantity" error={state?.errors?.quantity}>
          <Input
            id="record-quantity"
            name="quantity"
            type="number"
            min={MIN_QUANTITY}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            invalid={!!state?.errors?.quantity}
          />
        </Field>
      )}

      <Field
        label="Message or note"
        htmlFor="record-message"
        optional
        error={state?.errors?.message}
      >
        <Textarea
          id="record-message"
          name="message"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE}
          placeholder="e.g. Card handed over at the reception"
          invalid={!!state?.errors?.message}
        />
      </Field>

      <SubmitButton pendingLabel="Recording…">Record gift</SubmitButton>
    </form>
  );
}
