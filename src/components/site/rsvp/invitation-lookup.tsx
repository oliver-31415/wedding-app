"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Card, CardBody, Field, Input, Notice } from "@/components/ui";
import { formatDateLong } from "@/lib/dates";
import {
  lookupInvitationAction,
  requestNameCheckAction,
  selectHouseholdAction,
  type LookupActionState,
  type NameCheckActionState,
} from "./actions";
import { NameCheckRequest } from "./name-check-request";

export function InvitationLookup({
  weddingId,
  slug,
  redirectTo = null,
  deadline = null,
  heading = "Find your invitation",
  description = "Enter your first and last name as it appears on your invitation.",
}: {
  weddingId: string;
  slug: string;
  redirectTo?: string | null;
  deadline?: string | null;
  heading?: string;
  description?: string;
}) {
  const router = useRouter();
  const [state, formAction, isLookupPending] = useActionState<LookupActionState, FormData>(
    lookupInvitationAction,
    null,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dismissedState, setDismissedState] = useState<LookupActionState>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [isSelectPending, startSelectTransition] = useTransition();

  // Asking the couple to check the name (after "couldn't find", or "none of these").
  const [askState, askAction, isAskPending] = useActionState<NameCheckActionState, FormData>(
    requestNameCheckAction,
    null,
  );
  const [askFromChoices, setAskFromChoices] = useState(false);
  const [staleAsk, setStaleAsk] = useState<NameCheckActionState>(null);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    // A new search starts the "ask" part afresh.
    setPrevState(state);
    setStaleAsk(askState);
    setAskFromChoices(false);
  }
  const liveAsk = askState !== staleAsk ? askState : null;
  const couple = state?.kind === "none" || state?.kind === "choose" ? state.couple : "the couple";
  const showAsk = state?.kind === "none" || askFromChoices;

  useEffect(() => {
    if (state?.kind === "matched" && !redirectTo) {
      router.refresh();
    }
  }, [state, redirectTo, router]);

  const showChoices = state?.kind === "choose" && state !== dismissedState;

  function handleSelect(householdId: string, choice: string) {
    setSelectError(null);
    setSelectingId(householdId);
    startSelectTransition(async () => {
      const res = await selectHouseholdAction({
        weddingId,
        householdId,
        choice,
        redirectTo,
      });
      if (!res.ok) {
        setSelectError(res.message);
        setSelectingId(null);
        return;
      }
      if (!redirectTo) {
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          {heading}
        </h2>
        <p className="text-sm text-ink-muted sm:text-base">{description}</p>
        {deadline && (
          <p className="text-sm font-medium text-accent-strong">
            Please respond by {formatDateLong(deadline)}
          </p>
        )}
      </div>

      <Card className="shadow-xs">
        <CardBody className="p-6 sm:p-8">
          {liveAsk?.kind === "sent" ? (
            <div className="space-y-4 text-center" role="status">
              <h3 className="font-serif text-2xl font-medium text-ink">Thanks</h3>
              <p className="text-base text-ink-muted">
                We&apos;ve asked {couple} to check. They&apos;ll email your invitation link to{" "}
                <span className="font-medium break-words text-ink">{liveAsk.email}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStaleAsk(askState);
                  setAskFromChoices(false);
                }}
                className="inline-flex min-h-10 items-center text-sm text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
              >
                Search again
              </button>
            </div>
          ) : showChoices ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="font-serif text-2xl font-medium text-ink">Is this you?</h3>
                <p className="text-sm text-ink-muted">
                  Choose your invitation below to continue.
                </p>
              </div>

              {selectError && <Notice tone="bad">{selectError}</Notice>}

              <div className="space-y-2.5">
                {state.options.map((opt) => {
                  const busy = isSelectPending && selectingId === opt.householdId;
                  return (
                    <button
                      key={opt.householdId}
                      type="button"
                      disabled={isSelectPending}
                      onClick={() => handleSelect(opt.householdId, opt.choice)}
                      className="flex min-h-13 w-full items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 text-left text-base font-medium text-ink transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-50"
                    >
                      <span>{opt.label}</span>
                      <span className="text-sm font-normal text-accent-strong">
                        {busy ? "Opening…" : "Select →"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col items-start gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDismissedState(state);
                    setSelectError(null);
                  }}
                  disabled={isSelectPending}
                  className="inline-flex min-h-10 items-center text-sm text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
                >
                  None of these — search again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedState(state);
                    setSelectError(null);
                    setAskFromChoices(true);
                  }}
                  disabled={isSelectPending}
                  className="inline-flex min-h-10 items-center text-sm text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
                >
                  None of these — ask {state.couple} to check
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <form action={formAction} className="space-y-5" noValidate>
                <input type="hidden" name="weddingId" value={weddingId} />
                <input type="hidden" name="slug" value={slug} />
                {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

                {state && state.kind === "none" && <Notice tone="warn">{state.message}</Notice>}
                {state && state.kind === "too_many" && <Notice tone="warn">{state.message}</Notice>}
                {state && state.kind === "rate_limited" && <Notice tone="bad">{state.message}</Notice>}
                {state && state.kind === "error" && !state.errors && (
                  <Notice tone="bad">{state.message}</Notice>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="First name"
                    htmlFor="lookup-first-name"
                    error={state?.kind === "error" ? state.errors?.firstName : undefined}
                  >
                    <Input
                      id="lookup-first-name"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      invalid={state?.kind === "error" && !!state.errors?.firstName}
                      className="h-11 text-base focus:border-accent"
                    />
                  </Field>

                  <Field
                    label="Last name"
                    htmlFor="lookup-last-name"
                    error={state?.kind === "error" ? state.errors?.lastName : undefined}
                  >
                    <Input
                      id="lookup-last-name"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      invalid={state?.kind === "error" && !!state.errors?.lastName}
                      className="h-11 text-base focus:border-accent"
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  disabled={isLookupPending}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-6 text-base font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isLookupPending ? "Searching…" : "Find my invitation"}
                </button>
              </form>
              {showAsk && (
                <div className="border-t border-line pt-6">
                  <NameCheckRequest
                    weddingId={weddingId}
                    firstName={firstName}
                    lastName={lastName}
                    couple={couple}
                    state={liveAsk}
                    action={askAction}
                    pending={isAskPending}
                  />
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
