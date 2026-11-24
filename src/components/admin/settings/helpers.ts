import type { PageType } from "@/db/schema";

export type SelectOption = { value: string; label: string };

export const TIME_ZONES: readonly SelectOption[] = [
  { value: "Australia/Sydney", label: "Australia/Sydney — Sydney, Canberra" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne — Melbourne" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane — Brisbane" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide — Adelaide" },
  { value: "Australia/Perth", label: "Australia/Perth — Perth" },
  { value: "Australia/Hobart", label: "Australia/Hobart — Hobart" },
  { value: "Australia/Darwin", label: "Australia/Darwin — Darwin" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland — Auckland" },
  { value: "Europe/London", label: "Europe/London — London" },
  { value: "America/New_York", label: "America/New_York — New York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles — Los Angeles" },
  { value: "Asia/Singapore", label: "Asia/Singapore — Singapore" },
];

export const CURRENCIES: readonly SelectOption[] = [
  { value: "AUD", label: "AUD — Australian dollar" },
  { value: "NZD", label: "NZD — New Zealand dollar" },
  { value: "GBP", label: "GBP — British pound" },
  { value: "USD", label: "USD — US dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "CAD", label: "CAD — Canadian dollar" },
  { value: "SGD", label: "SGD — Singapore dollar" },
];

/** Keeps the wedding's existing time zone selectable even if outside the standard list. */
export function timeZoneOptions(currentTimeZone: string): SelectOption[] {
  if (TIME_ZONES.some((z) => z.value === currentTimeZone)) return [...TIME_ZONES];
  return [{ value: currentTimeZone, label: currentTimeZone }, ...TIME_ZONES];
}

export function currencyOptions(currentCurrency: string): SelectOption[] {
  if (CURRENCIES.some((c) => c.value === currentCurrency)) return [...CURRENCIES];
  return [{ value: currentCurrency, label: currentCurrency }, ...CURRENCIES];
}

export function isAllowedTimeZone(value: string, currentTimeZone: string): boolean {
  return value === currentTimeZone || TIME_ZONES.some((z) => z.value === value);
}

export function isAllowedCurrency(value: string, currentCurrency: string): boolean {
  return value === currentCurrency || CURRENCIES.some((c) => c.value === value);
}

export type PublishWarning = {
  id: "no_pages" | "rsvp_without_events";
  title: string;
  body: string;
  href: string;
  actionLabel: string;
};

/**
 * Warnings shown before publishing (never blockers).
 */
export function getPublishWarnings(input: {
  pageTypes: readonly PageType[];
  rsvpEventCount: number;
}): PublishWarning[] {
  const warnings: PublishWarning[] = [];
  if (input.pageTypes.length === 0) {
    warnings.push({
      id: "no_pages",
      title: "No pages added yet",
      body: "Your guest site starts empty. Add at least one page so guests have something to see when you publish.",
      href: "/admin/website",
      actionLabel: "Go to Website",
    });
  }
  if (input.pageTypes.includes("rsvp") && input.rsvpEventCount === 0) {
    warnings.push({
      id: "rsvp_without_events",
      title: "No events collect RSVPs yet",
      body: "You have an RSVP page, but none of your events are collecting RSVPs. Turn on RSVPs for an event in your schedule.",
      href: "/admin/schedule",
      actionLabel: "Go to Schedule",
    });
  }
  return warnings;
}

export const COHOST_INVITE_DAYS = 7;

export function cohostInviteExpiry(now = Date.now()): Date {
  return new Date(now + COHOST_INVITE_DAYS * 86_400_000);
}

export function isInviteActive(expiresAt: Date, now = Date.now()): boolean {
  return expiresAt.getTime() > now;
}
