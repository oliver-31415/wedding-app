import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";

const toneClass: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-ink-muted",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand-strong",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 font-sans text-xs font-medium tracking-normal whitespace-nowrap normal-case", toneClass[tone])}>
      {children}
    </span>
  );
}

/** Inline message box. Use for action results and warnings. */
export function Notice({ tone = "info", title, children }: { tone?: Exclude<Tone, "neutral" | "brand">; title?: ReactNode; children?: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("rounded-lg px-4 py-3 text-sm", toneClass[tone])}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cn(title ? "mt-0.5" : null)}>{children}</div>}
    </div>
  );
}

/** Renders an ActionState's message (if any) as a Notice. */
export function FormMessage({ state }: { state: { ok?: boolean; message?: string } | null | undefined }) {
  if (!state?.message) return null;
  return <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>;
}
