"use client";

import { cn, Input } from "@/components/ui";
import { DIETARY_NEEDS, editDietary, hasNoNeeds, MAX_DIETARY_NOTE, parseDietary } from "@/lib/rsvp/dietary";

const Tick = ({ on }: { on: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
      on ? "border-accent bg-accent" : "border-line-strong bg-surface",
    )}
  >
    {on && (
      <svg viewBox="0 0 16 16" className="size-3.5 text-accent-ink" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </span>
);

/** The dietary checklist on the guest RSVP form: tick what applies, or "none", plus a note. */
export function DietaryControl({
  id,
  labelledBy,
  ariaLabel,
  value,
  invalid,
  locked,
  onChange,
}: {
  id: string;
  /** The question's label element, or `ariaLabel` when there isn't one. */
  labelledBy?: string;
  ariaLabel?: string;
  value: string;
  invalid: boolean;
  locked: boolean;
  onChange: (value: string) => void;
}) {
  const answer = value ? parseDietary(value, { keepSpaces: true }) : null;
  const none = !!answer && hasNoNeeds(answer);
  const chip = (on: boolean) =>
    cn(
      "flex min-h-11 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors sm:gap-3 sm:px-3.5 sm:text-base",
      on
        ? "border-accent bg-accent/8 font-medium text-ink"
        : invalid
          ? "border-bad/60 bg-surface text-ink hover:border-accent/60"
          : "border-line-strong bg-surface text-ink hover:border-accent/60 hover:bg-canvas",
    );

  return (
    <div className="space-y-2.5">
      <div role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : ariaLabel} className="grid grid-cols-2 gap-2">
        <label className={cn(chip(none), "col-span-2")}>
          <input
            type="checkbox"
            checked={none}
            disabled={locked}
            onChange={(e) => onChange(editDietary(value, { none: e.target.checked }))}
            className="sr-only"
          />
          <Tick on={none} />
          <span>No dietary requirements</span>
        </label>
        {DIETARY_NEEDS.map((n) => {
          const on = !!answer?.needs.includes(n.id);
          return (
            <label key={n.id} className={chip(on)}>
              <input
                type="checkbox"
                checked={on}
                disabled={locked}
                onChange={(e) => onChange(editDietary(value, { need: n.id, on: e.target.checked }))}
                className="sr-only"
              />
              <Tick on={on} />
              <span>{n.label}</span>
            </label>
          );
        })}
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-note`} className="text-sm text-ink-muted">
          Anything else, or how serious an allergy is
        </label>
        <Input
          id={`${id}-note`}
          value={answer?.note ?? ""}
          maxLength={MAX_DIETARY_NOTE}
          invalid={invalid}
          disabled={locked}
          onChange={(e) => onChange(editDietary(value, { note: e.target.value }))}
          placeholder="e.g. anaphylactic to peanuts, low FODMAP"
          className="text-base focus:border-accent"
        />
      </div>
    </div>
  );
}
