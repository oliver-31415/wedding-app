import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
    variant === "primary" && "bg-brand text-white hover:bg-brand-strong",
    variant === "secondary" && "border border-control bg-surface text-ink hover:bg-sunken",
    variant === "ghost" && "text-ink-muted hover:bg-sunken hover:text-ink",
    variant === "danger" && "border border-bad/30 bg-surface text-bad hover:bg-bad-soft",
    extra,
  );
}

type Variants = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & Variants) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & Variants) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
