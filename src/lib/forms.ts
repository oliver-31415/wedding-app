/**
 * Helpers for Server Actions. Every admin form uses `useActionState` with an
 * action returning `ActionState`, so success/error display is identical
 * everywhere (render with <FormMessage state={state} /> and field errors via
 * <Field error={state?.errors?.name}>).
 */
import type { Audience } from "@/db/schema";
import { parseAudience } from "@/lib/audience";

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;

export const ok = (message?: string): ActionState => ({ ok: true, message });
export const fail = (message: string, errors?: Record<string, string>): ActionState => ({ ok: false, message, errors });

/** Trimmed string, or null when empty. The "no default content" rule: blank means null. */
export function text(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function bool(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** Whole number, or `fallback` for blank/invalid input ("2abc" is invalid). Clamp ranges yourself. */
export function int(formData: FormData, name: string, fallback = 0): number {
  const raw = String(formData.get(name) ?? "").trim();
  return /^-?\d+$/.test(raw) ? Number(raw) : fallback;
}

/** Reads an <AudiencePicker name={name}>. */
export function readAudience(formData: FormData, name = "audience"): Audience | { error: string } {
  return parseAudience(String(formData.get(`${name}Mode`) ?? "all"), formData.getAll(`${name}Tags`).map(String));
}

/** New order of ids after moving `id` one step. Unchanged if it can't move. */
export function moveId(ids: string[], id: string, direction: "up" | "down"): string[] {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** URL-safe slug from a title. */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
