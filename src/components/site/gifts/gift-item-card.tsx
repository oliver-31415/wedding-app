"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, Notice, SubmitButton, TextBlock, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { MAX_EMAIL, MAX_MESSAGE, MAX_NAME } from "@/lib/gift-admin/helpers";
import { formatMoney } from "@/lib/money";
import { claimGiftAction } from "./actions";
import { GiftPicture } from "./gift-picture";

export type GuestGiftItem = {
  id: string;
  name: string;
  url: string | null;
  storeName: string | null;
  priceCents: number | null;
  quantityWanted: number;
  mostWanted: boolean;
  note: string | null;
  imageUrl: string | null;
  remaining: number;
  complete: boolean;
};

export function GiftItemCard({
  slug,
  currency,
  item,
  defaultGiverName,
}: {
  slug: string;
  currency: string;
  item: GuestGiftItem;
  defaultGiverName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [giverName, setGiverName] = useState(defaultGiverName ?? "");
  const [giverEmail, setGiverEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");

  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await claimGiftAction(prev, formData);
    if (res?.ok) {
      setOpen(false);
      setGiverEmail("");
      setQuantity("1");
      setMessage("");
    }
    return res;
  }, null);

  return (
    <article
      className={`flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-opacity ${
        item.complete ? "opacity-75" : ""
      }`}
    >
      {item.imageUrl && (
        <div className="mb-5">
          <GiftPicture src={item.imageUrl} alt={item.name} muted={item.complete} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {item.mostWanted && !item.complete && (
              <span className="inline-flex items-center rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-medium text-accent-strong">
                Most wanted
              </span>
            )}
            <h3 className="font-serif text-2xl leading-snug font-medium text-ink">{item.name}</h3>
          </div>
          {item.priceCents != null && (
            <p className="shrink-0 text-base font-medium text-ink tabular-nums">
              {formatMoney(item.priceCents, currency)}
            </p>
          )}
        </div>

        {(item.storeName || (item.quantityWanted > 1 && !item.complete)) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            {item.storeName && <span>{item.storeName}</span>}
            {item.quantityWanted > 1 && !item.complete && (
              <span>
                {item.remaining} of {item.quantityWanted} still wanted
              </span>
            )}
          </div>
        )}

        {item.note && (
          <TextBlock text={item.note} className="text-sm leading-relaxed text-ink-muted" />
        )}

        {state?.ok && <Notice tone="good">{state.message}</Notice>}

        <div className="mt-auto pt-2">
          {item.complete ? (
            <span className="inline-flex items-center rounded-full bg-good-soft px-3 py-1 text-sm font-medium text-good">
              Gifted — thank you!
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:bg-sunken"
                >
                  View in store ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium whitespace-nowrap text-white transition-opacity hover:opacity-90"
              >
                {open ? "Close" : "I've bought this"}
              </button>
            </div>
          )}
        </div>

        {open && !item.complete && (
          <form
            action={action}
            className="mt-4 space-y-4 border-t border-line pt-5"
            noValidate
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="itemId" value={item.id} />
            {item.remaining === 1 && <input type="hidden" name="quantity" value="1" />}

            {state && !state.ok && <FormMessage state={state} />}

            <Field label="Your name" htmlFor={`claim-name-${item.id}`} error={state?.errors?.giverName}>
              <Input
                id={`claim-name-${item.id}`}
                name="giverName"
                value={giverName}
                onChange={(e) => setGiverName(e.target.value)}
                maxLength={MAX_NAME}
                placeholder="e.g. Alex & Sam"
                required
                invalid={!!state?.errors?.giverName}
              />
            </Field>

            <Field
              label="Email"
              htmlFor={`claim-email-${item.id}`}
              optional
              error={state?.errors?.giverEmail}
            >
              <Input
                id={`claim-email-${item.id}`}
                name="giverEmail"
                type="email"
                value={giverEmail}
                onChange={(e) => setGiverEmail(e.target.value)}
                maxLength={MAX_EMAIL}
                placeholder="you@example.com"
                invalid={!!state?.errors?.giverEmail}
              />
            </Field>

            {item.remaining > 1 && (
              <Field
                label="Quantity"
                htmlFor={`claim-qty-${item.id}`}
                hint={`Up to ${item.remaining} still wanted.`}
                error={state?.errors?.quantity}
              >
                <Input
                  id={`claim-qty-${item.id}`}
                  name="quantity"
                  type="number"
                  min={1}
                  max={item.remaining}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  invalid={!!state?.errors?.quantity}
                />
              </Field>
            )}

            <Field
              label="Message to the couple"
              htmlFor={`claim-msg-${item.id}`}
              optional
              error={state?.errors?.message}
            >
              <Textarea
                id={`claim-msg-${item.id}`}
                name="message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_MESSAGE}
                placeholder="Write a note for the couple"
                invalid={!!state?.errors?.message}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton
                pendingLabel="Saving…"
                className="bg-accent hover:bg-accent hover:opacity-90"
              >
                Confirm gift
              </SubmitButton>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
