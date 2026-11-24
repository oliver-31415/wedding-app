/**
 * The status vocabulary (docs/CONVENTIONS.md) as data: every label and badge
 * tone shown for a status comes from here — the UI kit's status badges, the
 * guest list, CSV export and the page manager all read these maps.
 */
import type { PageVisibility } from "@/db/schema";
import type { GuestEventStatus, HouseholdRsvpState } from "@/lib/rsvp/model";

export type StatusTone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";
type Word = { label: string; tone: StatusTone };

export const GUEST_EVENT_STATUS: Record<GuestEventStatus, Word> = {
  attending: { label: "Attending", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  pending: { label: "Awaiting reply", tone: "warn" },
  not_invited: { label: "Not invited", tone: "neutral" },
};

export const HOUSEHOLD_STATE: Record<HouseholdRsvpState, Word> = {
  complete: { label: "Replied", tone: "good" },
  partial: { label: "Partly replied", tone: "warn" },
  not_started: { label: "Awaiting reply", tone: "warn" },
  none: { label: "No RSVP needed", tone: "neutral" },
};

export const PAGE_VISIBILITY: Record<PageVisibility, Word & { hint: string }> = {
  public: { label: "Everyone", tone: "info", hint: "Anyone with the link can see this page once your site is published." },
  password: {
    label: "Password",
    tone: "brand",
    hint: "Guests enter your site password, or find their invitation by name or personal link.",
  },
  guests: {
    label: "Invited guests",
    tone: "brand",
    hint: "Only guests who have found their invitation (by name or personal link) and match who you choose below.",
  },
  hidden: { label: "Hidden", tone: "neutral", hint: "Only you can see this page while previewing." },
};
