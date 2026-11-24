/**
 * The status vocabulary from docs/CONVENTIONS.md, as components. Always use
 * these instead of writing the words and tones by hand, so every screen agrees.
 */
import type { PageVisibility } from "@/db/schema";
import type { GuestEventStatus, HouseholdRsvpState } from "@/lib/rsvp/model";
import { GUEST_EVENT_STATUS, HOUSEHOLD_STATE, PAGE_VISIBILITY } from "@/lib/status-words";
import { Badge } from "./feedback";

export function GuestEventBadge({ status }: { status: GuestEventStatus }) {
  const { label, tone } = GUEST_EVENT_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const householdStateLabel = (s: HouseholdRsvpState) => HOUSEHOLD_STATE[s].label;
export function HouseholdBadge({ state }: { state: HouseholdRsvpState }) {
  const { label, tone } = HOUSEHOLD_STATE[state];
  return <Badge tone={tone}>{label}</Badge>;
}

export function SiteBadge({ published }: { published: boolean }) {
  return published ? <Badge tone="good">Published</Badge> : <Badge tone="warn">Draft</Badge>;
}

export const visibilityLabel = (v: PageVisibility) => PAGE_VISIBILITY[v].label;
export function VisibilityBadge({ visibility: v }: { visibility: PageVisibility }) {
  return <Badge tone={PAGE_VISIBILITY[v].tone}>{PAGE_VISIBILITY[v].label}</Badge>;
}

/** Nothing when nobody has claimed it yet. */
export function GiftProgressBadge({ claimed, wanted }: { claimed: number; wanted: number }) {
  if (claimed <= 0) return null;
  if (claimed >= wanted) return <Badge tone="good">Gifted</Badge>;
  return (
    <Badge tone="info">
      {claimed} of {wanted} gifted
    </Badge>
  );
}

export function PledgeBadge({ received }: { received: boolean }) {
  return received ? <Badge tone="good">Received</Badge> : <Badge tone="warn">Pledged</Badge>;
}

export function ThankedBadge({ thanked }: { thanked: boolean }) {
  return thanked ? <Badge tone="good">Thanked</Badge> : <Badge tone="warn">To thank</Badge>;
}

export function DeliveryBadge({ status }: { status: "sent" | "failed" }) {
  return status === "sent" ? <Badge tone="good">Sent</Badge> : <Badge tone="bad">Failed</Badge>;
}
