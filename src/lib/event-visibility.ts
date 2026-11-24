/**
 * Who can see an event on the guest site (schedule, calendar downloads).
 * The one rule — use it everywhere events are shown to guests.
 *
 *  - hosts see everything;
 *  - an event open to everyone is public, unless the couple ticked
 *    "Only show this event to invited guests";
 *  - otherwise (tag-limited or guests-only) the visitor must have found their
 *    invitation and someone in their household must be invited.
 */
import type { Audience } from "@/db/schema";
import { isInvited, type SnapGuest } from "@/lib/rsvp/model";

type VisibleEvent = { id: string; audience: Audience; guestsOnly: boolean };
type Viewer = { isHost: boolean; householdId: string | null };

export function eventNeedsGuest(event: VisibleEvent): boolean {
  return event.guestsOnly || event.audience.mode === "tags";
}

export function canSeeEvent(event: VisibleEvent, viewer: Viewer, householdGuests: SnapGuest[]): boolean {
  if (viewer.isHost) return true;
  if (!eventNeedsGuest(event)) return true;
  if (!viewer.householdId) return false;
  const snapEvent = { ...event, name: "", rsvpEnabled: true, position: 0 };
  return householdGuests.some((g) => isInvited(g, snapEvent, householdGuests));
}

/**
 * Events this viewer may see, plus whether to show the "find your invitation
 * to see everything" prompt. The prompt never says what's hidden or how many.
 */
export function visibleEvents<T extends VisibleEvent>(
  events: T[],
  viewer: Viewer,
  householdGuests: SnapGuest[],
): { events: T[]; promptToIdentify: boolean } {
  const shown = events.filter((e) => canSeeEvent(e, viewer, householdGuests));
  const hiddenForAnonymous = !viewer.isHost && !viewer.householdId && events.some(eventNeedsGuest);
  return { events: shown, promptToIdentify: hiddenForAnonymous };
}
