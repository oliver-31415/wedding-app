import { PAGE_TYPES, type PageType } from "@/db/schema";
import { wallTimeToInstant } from "@/lib/dates";
import { slugify } from "@/lib/forms";
import { resolveSafeNext } from "@/lib/rsvp-guest/safe-next";
import { sitePath } from "@/lib/site-paths";

export type PageTypeMeta = {
  type: PageType;
  label: string;
  defaultTitle: string;
  description: string;
  /** Fixed URL slug under the guest site, or null for custom pages. */
  fixedSlug: string | null;
  /** Non-custom types can be added at most once per wedding. */
  singleton: boolean;
  /** Uses ordered page_items rows (story / party / faq). */
  hasItems: boolean;
};

export const PAGE_TYPE_META: Record<PageType, PageTypeMeta> = {
  home: {
    type: "home",
    label: "Home",
    defaultTitle: "Home",
    description: "A welcome note on the front page of your website.",
    fixedSlug: "",
    singleton: true,
    hasItems: false,
  },
  schedule: {
    type: "schedule",
    label: "Schedule",
    defaultTitle: "Schedule",
    description: "Events, times, venues and calendar links from your schedule.",
    fixedSlug: "schedule",
    singleton: true,
    hasItems: false,
  },
  story: {
    type: "story",
    label: "Our story",
    defaultTitle: "Our story",
    description: "Share how you met and milestones along the way.",
    fixedSlug: "story",
    singleton: true,
    hasItems: true,
  },
  party: {
    type: "party",
    label: "Wedding party",
    defaultTitle: "Wedding party",
    description: "Introduce the people standing beside you.",
    fixedSlug: "wedding-party",
    singleton: true,
    hasItems: true,
  },
  faq: {
    type: "faq",
    label: "Q&A",
    defaultTitle: "Q&A",
    description: "Answers to common questions from your guests.",
    fixedSlug: "faq",
    singleton: true,
    hasItems: true,
  },
  gifts: {
    type: "gifts",
    label: "Gift list",
    defaultTitle: "Gift list",
    description: "Your gift items and cash funds.",
    fixedSlug: "gifts",
    singleton: true,
    hasItems: false,
  },
  rsvp: {
    type: "rsvp",
    label: "RSVP",
    defaultTitle: "RSVP",
    description: "Let guests find their invitation and reply online.",
    fixedSlug: "rsvp",
    singleton: true,
    hasItems: false,
  },
  photos: {
    type: "photos",
    label: "Photos",
    defaultTitle: "Photos",
    description: "A small, chosen set of photos (up to 12).",
    fixedSlug: "photos",
    singleton: true,
    hasItems: false,
  },
  custom: {
    type: "custom",
    label: "Custom page",
    defaultTitle: "",
    description: "A blank page for anything else you want to share.",
    fixedSlug: null,
    singleton: false,
    hasItems: false,
  },
};

export const RESERVED_SLUGS = new Set<string>([
  "",
  "schedule",
  "story",
  "wedding-party",
  "faq",
  "gifts",
  "rsvp",
  "photos",
  "unlock",
  "find",
  "i",
  "event",
  // App routes: a wedding served at the root shares the domain with these.
  "admin",
  "api",
  "login",
  "logout",
  "signup",
  "onboarding",
  "invite",
  "verify-email",
  "forgot-password",
  "reset-password",
  "site-admin",
  "uploads",
  "w",
]);

export function isPageType(value: string): value is PageType {
  return (PAGE_TYPES as readonly string[]).includes(value);
}

/** Page types that can still be added to this wedding. */
export function addablePageTypes(existingPages: Pick<{ type: PageType }, "type">[]): PageTypeMeta[] {
  const existing = new Set(existingPages.map((p) => p.type));
  return PAGE_TYPES.map((type) => PAGE_TYPE_META[type]).filter((meta) => !meta.singleton || !existing.has(meta.type));
}

export function canAddPageType(type: PageType, existingPages: Pick<{ type: PageType }, "type">[]): boolean {
  const meta = PAGE_TYPE_META[type];
  if (!meta.singleton) return true;
  return !existingPages.some((p) => p.type === type);
}

/** Validate and normalise a custom page URL slug. */
export function validateCustomSlug(
  raw: string,
  existingSlugs: Iterable<string>,
  currentSlug?: string,
): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = slugify(raw);
  if (!slug) {
    return { ok: false, error: "Enter a URL slug using letters or numbers." };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: "That URL is reserved. Choose a different slug." };
  }
  const taken = new Set(existingSlugs);
  if (currentSlug !== undefined) taken.delete(currentSlug);
  if (taken.has(slug)) {
    return { ok: false, error: "Another page already uses that URL." };
  }
  return { ok: true, slug };
}

/** Generate a unique, non-reserved URL slug from a custom page title. */
export function uniqueCustomSlug(title: string, existingSlugs: Iterable<string>): string {
  const taken = new Set(existingSlugs);
  const base = slugify(title) || "page";
  if (!RESERVED_SLUGS.has(base) && !taken.has(base)) return base;
  let n = 2;
  while (RESERVED_SLUGS.has(`${base}-${n}`) || taken.has(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}

/** Public path for a page on the guest site whose base is `siteBase` (see src/lib/site-paths.ts). */
export function pageUrl(siteBase: string, pageSlug: string): string {
  return sitePath(siteBase, pageSlug);
}

/** Labels, tones and hints for page visibility — the shared vocabulary. */
export { PAGE_VISIBILITY as VISIBILITY_META } from "@/lib/status-words";

export type PageAccess = "ok" | "unpublished" | "hidden" | "needs_password" | "needs_guest" | "not_for_you";

export function sortPages<T extends { position: number }>(pages: T[]): T[] {
  return [...pages].sort((a, b) => a.position - b.position);
}

/**
 * Pages shown in guest-site navigation, in position order.
 * Includes "ok" pages and "needs_password" pages (so guests can unlock);
 * omits "hidden", "not_for_you", "needs_guest" and "unpublished".
 */
export function selectNavPages<T extends { position: number }>(
  pages: T[],
  accessOf: (page: T) => PageAccess,
): T[] {
  return sortPages(pages).filter((p) => {
    const access = accessOf(p);
    return access === "ok" || access === "needs_password";
  });
}

export type HomeLanding<T> =
  | { kind: "render"; page: T }
  | { kind: "redirect"; slug: string }
  | { kind: "unlock" }
  | { kind: "needs_guest"; page: T }
  | { kind: "empty" };

/**
 * Decides what the guest site's home address renders or redirects to.
 * Renders the home page if it exists and is viewable; otherwise redirects to
 * the first viewable page; if no pages can be shown, returns "empty" so only
 * the couple's names (and date/location if set) appear.
 */
export function resolveHomeLanding<T extends { type: PageType; slug: string; position: number }>(
  pages: T[],
  accessOf: (page: T) => PageAccess,
): HomeLanding<T> {
  const ordered = sortPages(pages);
  const home = ordered.find((p) => p.type === "home");
  const homeAccess = home ? accessOf(home) : null;

  if (home && homeAccess === "ok") {
    return { kind: "render", page: home };
  }

  const firstOk = ordered.find((p) => p.type !== "home" && accessOf(p) === "ok");
  if (firstOk) {
    return { kind: "redirect", slug: firstOk.slug };
  }

  if (home && homeAccess === "needs_password") {
    return { kind: "unlock" };
  }

  const firstPassword = ordered.find((p) => p.type !== "home" && accessOf(p) === "needs_password");
  if (firstPassword) {
    return { kind: "redirect", slug: firstPassword.slug };
  }

  if (home && homeAccess === "needs_guest") {
    return { kind: "needs_guest", page: home };
  }

  // Everything is for invited guests only: offer the invitation lookup rather than a blank page.
  const firstGuestOnly = ordered.find((p) => accessOf(p) === "needs_guest");
  if (firstGuestOnly) {
    return { kind: "needs_guest", page: firstGuestOnly };
  }

  return { kind: "empty" };
}

/** Only allow redirects back to the same wedding site; anything else goes to its home. */
export function safeNextPath(next: string | null | undefined, siteBase: string): string {
  return resolveSafeNext(siteBase, next, sitePath(siteBase));
}

// Design styles and accent colour utilities live in src/lib/site-styles.ts.

// ------------------------------------------------------------ schedule times

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function splitWallTime(wall: string | null | undefined): { date: string; time: string } {
  if (!wall) return { date: "", time: "" };
  const [date = "", time = ""] = wall.split("T");
  return { date, time: time.slice(0, 5) };
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function parseEventTimes(
  date: string | null,
  startTime: string | null,
  endTime: string | null,
): { ok: true; startsAt: string | null; endsAt: string | null } | { ok: false; errors: Record<string, string> } {
  const d = date?.trim() || null;
  const s = startTime?.trim() || null;
  const e = endTime?.trim() || null;

  if (!d && !s && !e) {
    return { ok: true, startsAt: null, endsAt: null };
  }

  const errors: Record<string, string> = {};
  if (!d) errors.date = "Enter a date for this event.";
  else if (!DATE_RE.test(d)) errors.date = "Enter a valid date.";

  if (!s) errors.startTime = "Enter a start time, or clear the date for time to be announced.";
  else if (!TIME_RE.test(s)) errors.startTime = "Enter a valid start time.";

  if (e && !TIME_RE.test(e)) {
    errors.endTime = "Enter a valid end time.";
  } else if (s && e && e === s) {
    errors.endTime = "End time must be different from the start time.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // An end time earlier than the start means the event runs past midnight
  // (e.g. a reception from 6:00 pm to 12:30 am) — it ends the next day.
  const endDate = e && s && e < s ? nextDay(d!) : d;
  return {
    ok: true,
    startsAt: `${d}T${s}`,
    endsAt: e ? `${endDate}T${e}` : null,
  };
}

// ------------------------------------------------------------ calendar & maps

export function formatIcsUtc(instantMs: number): string {
  return new Date(instantMs)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function eventCalendarBounds(
  startsAt: string,
  endsAt: string | null,
  timeZone: string,
): { startMs: number; endMs: number } {
  const startMs = wallTimeToInstant(startsAt, timeZone);
  const endMs = endsAt ? wallTimeToInstant(endsAt, timeZone) : startMs + 2 * 60 * 60 * 1000;
  return { startMs, endMs: endMs > startMs ? endMs : startMs + 60 * 60 * 1000 };
}

function eventLocationText(venueName: string | null, address: string | null): string {
  return [venueName?.trim(), address?.trim()].filter(Boolean).join(", ");
}

function eventDetailsText(dressCode: string | null, description: string | null): string {
  const parts: string[] = [];
  if (dressCode?.trim()) parts.push(`Dress code: ${dressCode.trim()}`);
  if (description?.trim()) parts.push(description.trim());
  return parts.join("\n\n");
}

export function buildGoogleCalendarUrl(
  wedding: { partnerOne: string; partnerTwo: string; timeZone: string },
  event: {
    name: string;
    startsAt: string;
    endsAt: string | null;
    venueName: string | null;
    address: string | null;
    dressCode: string | null;
    description: string | null;
  },
): string {
  const { startMs, endMs } = eventCalendarBounds(event.startsAt, event.endsAt, wedding.timeZone);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.name} — ${wedding.partnerOne} & ${wedding.partnerTwo}`,
    dates: `${formatIcsUtc(startMs)}/${formatIcsUtc(endMs)}`,
  });
  const location = eventLocationText(event.venueName, event.address);
  if (location) params.set("location", location);
  const details = eventDetailsText(event.dressCode, event.description);
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function buildEventIcs(
  wedding: { slug: string; partnerOne: string; partnerTwo: string; timeZone: string },
  event: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string | null;
    venueName: string | null;
    address: string | null;
    dressCode: string | null;
    description: string | null;
  },
  nowMs = Date.now(),
): string {
  const { startMs, endMs } = eventCalendarBounds(event.startsAt, event.endsAt, wedding.timeZone);
  const location = eventLocationText(event.venueName, event.address);
  const details = eventDetailsText(event.dressCode, event.description);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeddingApp//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@${wedding.slug}`,
    `DTSTAMP:${formatIcsUtc(nowMs)}`,
    `DTSTART:${formatIcsUtc(startMs)}`,
    `DTEND:${formatIcsUtc(endMs)}`,
    `SUMMARY:${escapeIcsText(`${event.name} — ${wedding.partnerOne} & ${wedding.partnerTwo}`)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  if (details) lines.push(`DESCRIPTION:${escapeIcsText(details)}`);
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function buildGoogleMapsUrl(venueName: string | null, address: string): string {
  const query = eventLocationText(venueName, address);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
