import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-lg border border-control bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:bg-sunken aria-[invalid=true]:border-bad aria-[invalid=true]:focus-visible:ring-bad/30";

/**
 * Label + control + hint/error. Pass the control as the single child and
 * give it the same `id` as `htmlFor`; Field links the hint/error to it with
 * aria-describedby. Errors come from the action's `errors[name]`.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const child =
    describedBy && isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": describedBy })
      : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-faint">Optional</span>}
      </label>
      {child}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(control, "h-10", className)} {...props} />;
}

/** Money input with the currency symbol shown inside the box. Parse with parseMoney(). */
export function MoneyInput({ className, invalid, symbol = "$", ...props }: ComponentProps<"input"> & { invalid?: boolean; symbol?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted">{symbol}</span>
      <input inputMode="decimal" aria-invalid={invalid || undefined} className={cn(control, "h-10 pl-7", className)} {...props} />
    </div>
  );
}

export function Textarea({ className, invalid, rows = 4, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea rows={rows} aria-invalid={invalid || undefined} className={cn(control, "py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, invalid, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return <select aria-invalid={invalid || undefined} className={cn(control, "h-10 pr-8", className)} {...props} />;
}

/** Search box for filtering lists. */
export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return <input type="search" className={cn(control, "h-10 max-w-xs", className)} {...props} />;
}

/** Checkbox with its label on the right. */
export function Checkbox({ label, hint, className, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 rounded border-control accent-brand" {...props} />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Radio options shown as a stacked list, grouped under an optional legend. */
export function RadioGroup({
  name,
  options,
  defaultValue,
  onChange,
  legend,
}: {
  name: string;
  options: { value: string; label: ReactNode; hint?: ReactNode }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  legend?: ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      {legend && <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>}
      {options.map((o) => (
        <label key={o.value} className="flex items-start gap-3 text-sm">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            onChange={onChange ? () => onChange(o.value) : undefined}
            className="mt-0.5 size-4 accent-brand"
          />
          <span>
            <span className="font-medium text-ink">{o.label}</span>
            {o.hint && <span className="block text-ink-muted">{o.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
