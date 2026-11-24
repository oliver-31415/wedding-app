import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Statistics components. Colours mean the same thing everywhere:
 * good = attending / received, bad = declined, warn = waiting on a reply,
 * neutral = not applicable.
 */

export function StatTile({
  label,
  value,
  detail,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-serif text-4xl leading-none font-medium text-ink [font-variant-numeric:lining-nums]">{value}</p>
      {detail && <div className="mt-2 space-y-2 text-sm text-ink-muted">{detail}</div>}
    </>
  );
  const cls = "block rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-line-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Single progress bar, e.g. "62 of 80 households replied". */
export function Progress({ value, max, tone = "brand", label }: { value: number; max: number; tone?: "brand" | "good"; label?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
    >
      <div className={cn("h-full rounded-full", tone === "good" ? "bg-good" : "bg-brand")} style={{ width: `${pct}%` }} />
    </div>
  );
}

const segmentTone = { good: "bg-good", bad: "bg-bad", warn: "bg-warn-fill", neutral: "bg-line-strong" } as const;
const dotTone = { good: "bg-good", bad: "bg-bad", warn: "bg-warn-fill", neutral: "bg-line-strong" } as const;

export type Segment = { label: string; value: number; tone: keyof typeof segmentTone };

/** Stacked bar + legend, e.g. attending / declined / waiting for one event. */
export function SegmentBar({ segments, label }: { segments: Segment[]; label?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={label ?? segments.map((s) => `${s.value} ${s.label}`).join(", ")}>
        {total > 0 &&
          segments.map((s) =>
            s.value > 0 ? <div key={s.label} className={segmentTone[s.tone]} style={{ width: `${(s.value / total) * 100}%` }} /> : null,
          )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", dotTone[s.tone])} />
            <span className="font-medium text-ink tabular-nums">{s.value}</span> {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars for answer counts (e.g. meal choices). */
export function BarList({ rows, total }: { rows: { label: string; value: number }[]; total?: number }) {
  const max = total ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="font-medium text-ink tabular-nums">{r.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand" style={{ width: `${max === 0 ? 0 : (r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
