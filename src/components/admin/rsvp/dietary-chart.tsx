import type { DietaryStats } from "@/lib/stats";

/** Distinct, muted colours that sit with the brand browns; "none" and "not answered" are greys. */
const PALETTE = ["#7c5c3e", "#2f7a4f", "#c0843d", "#4f6d8f", "#a3485a", "#6b8f71", "#8a6fb0", "#3d8a8a", "#b86b4b", "#5f5a52"];
const NONE_COLOUR = "#d6cec2";
const PENDING_COLOUR = "#efebe5";

export type Slice = { key: string; label: string; count: number; colour: string };

/** Chart slices: each combination of needs, then "No requirements", then "Not answered yet". */
export function dietarySlices(d: DietaryStats): Slice[] {
  const pending = d.people.filter((p) => !p.answer).length;
  let i = 0;
  const slices: Slice[] = d.groups.map((g) => ({
    ...g,
    colour: g.key === "none" ? NONE_COLOUR : PALETTE[i++ % PALETTE.length],
  }));
  if (pending) slices.push({ key: "pending", label: "Not answered yet", count: pending, colour: PENDING_COLOUR });
  return slices;
}

/** A donut of everyone asked, with the number who have requirements in the middle. */
export function DietaryDonut({ slices, withNeeds, size = 180 }: { slices: Slice[]; withNeeds: number; size?: number }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  const r = 15.9155; // circumference 100, so dash lengths are percentages
  let offset = 25; // start at 12 o'clock
  return (
    <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={describe(slices, total)} className="shrink-0">
      <circle cx="21" cy="21" r={r} fill="none" stroke={PENDING_COLOUR} strokeWidth="6" />
      {total > 0 &&
        slices.map((s) => {
          const pct = (s.count / total) * 100;
          const el = (
            <circle
              key={s.key}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={s.colour}
              strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
            />
          );
          offset -= pct;
          return el;
        })}
      <text x="21" y="20.5" textAnchor="middle" className="fill-ink" style={{ fontSize: 8, fontWeight: 600 }}>
        {withNeeds}
      </text>
      <text x="21" y="26.5" textAnchor="middle" className="fill-ink-muted" style={{ fontSize: 3.2 }}>
        of {total} with needs
      </text>
    </svg>
  );
}

/** Whole percentages, but never "0%" for someone who is there. */
function percent(n: number, total: number): string {
  if (!total || !n) return "0%";
  const p = Math.round((n / total) * 100);
  return p === 0 ? "<1%" : `${p}%`;
}

function describe(slices: Slice[], total: number): string {
  if (!total) return "Nobody has been asked yet";
  return slices.map((s) => `${s.label}: ${s.count}`).join(", ");
}

export function DietaryLegend({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((n, s) => n + s.count, 0);
  return (
    <ul className="w-full max-w-md min-w-0 flex-1 space-y-1.5 text-sm">
      {slices.map((s) => (
        <li key={s.key} className="flex items-center gap-2.5">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-sm border border-black/5" style={{ background: s.colour }} />
          <span className={s.key === "pending" || s.key === "none" ? "text-ink-muted" : "text-ink"}>{s.label}</span>
          <span className="ml-auto font-medium text-ink tabular-nums">{s.count}</span>
          <span className="w-10 text-right text-xs text-ink-faint tabular-nums">
            {percent(s.count, total)}
          </span>
        </li>
      ))}
    </ul>
  );
}
