"use client";

import { useActionState, useState } from "react";
import { CopyButton, Field, FormMessage, Input, Notice, SubmitButton, TextBlock, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { MAX_MESSAGE, MAX_NAME } from "@/lib/gift-admin/helpers";
import { formatMoney } from "@/lib/money";
import { pledgeFundAction } from "./actions";

export type GuestCashFund = {
  id: string;
  name: string;
  description: string | null;
  goalCents: number | null;
  pledgedCents: number;
  paymentInstructions: string | null;
  paymentUrl: string | null;
};

export function CashFundCard({
  slug,
  currency,
  fund,
  defaultGiverName,
}: {
  slug: string;
  currency: string;
  fund: GuestCashFund;
  defaultGiverName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [giverName, setGiverName] = useState(defaultGiverName ?? "");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await pledgeFundAction(prev, formData);
    if (res?.ok) {
      setOpen(false);
      setAmount("");
      setMessage("");
    }
    return res;
  }, null);

  const pct =
    fund.goalCents && fund.goalCents > 0
      ? Math.min(100, Math.round((fund.pledgedCents / fund.goalCents) * 100))
      : 0;

  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h3 className="font-serif text-2xl leading-snug font-medium text-ink">{fund.name}</h3>
          {fund.description && (
            <TextBlock text={fund.description} className="text-sm leading-relaxed text-ink-muted" />
          )}
        </div>

        {fund.goalCents != null && fund.goalCents > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-ink tabular-nums">
                {formatMoney(fund.pledgedCents, currency)} pledged
              </span>
              <span className="text-ink-muted tabular-nums">
                Goal: {formatMoney(fund.goalCents, currency)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={fund.goalCents}
              aria-valuenow={fund.pledgedCents}
              aria-label={`${fund.name} progress`}
              className="h-2 w-full overflow-hidden rounded-full bg-sunken"
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {fund.paymentInstructions && (
          <div className="rounded-xl border border-line bg-sunken/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Payment details
                </p>
                <TextBlock text={fund.paymentInstructions} className="text-sm text-ink" />
              </div>
              <CopyButton text={fund.paymentInstructions} label="Copy details" />
            </div>
          </div>
        )}

        {state?.ok && <Notice tone="good">{state.message}</Notice>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {fund.paymentUrl && (
            <a
              href={fund.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:bg-sunken"
            >
              Open payment link ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium whitespace-nowrap text-white transition-opacity hover:opacity-90"
          >
            {open ? "Close" : "Let the couple know"}
          </button>
        </div>

        {open && (
          <form
            action={action}
            className="mt-4 space-y-4 border-t border-line pt-5"
            noValidate
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="fundId" value={fund.id} />

            {state && !state.ok && <FormMessage state={state} />}

            <Field label="Your name" htmlFor={`pledge-name-${fund.id}`} error={state?.errors?.giverName}>
              <Input
                id={`pledge-name-${fund.id}`}
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
              label={`Amount (${currency})`}
              htmlFor={`pledge-amount-${fund.id}`}
              error={state?.errors?.amount}
            >
              <Input
                id={`pledge-amount-${fund.id}`}
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 150"
                required
                invalid={!!state?.errors?.amount}
              />
            </Field>

            <Field
              label="Message to the couple"
              htmlFor={`pledge-msg-${fund.id}`}
              optional
              error={state?.errors?.message}
            >
              <Textarea
                id={`pledge-msg-${fund.id}`}
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
                pendingLabel="Sending…"
                className="bg-accent hover:bg-accent hover:opacity-90"
              >
                Send pledge
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
