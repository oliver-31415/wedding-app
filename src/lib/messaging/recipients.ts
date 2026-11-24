import type { MessageRecipients } from "@/db/schema";
import { inAudience } from "@/lib/audience";
import {
  effectiveTagIds,
  householdIsAttending,
  householdRsvpState,
  responsesMap,
} from "@/lib/rsvp/model";
import type { WeddingSnapshot } from "@/lib/stats";

export type Recipient = { guestId: string; householdId: string; firstName: string; email: string };

export type RecipientPreview = {
  recipients: Recipient[];
  /** Guests who match the filter but have no email address. */
  missingEmail: { guestId: string; name: string }[];
  households: number;
};

/**
 * Who a message goes to. Filters are applied per household (an RSVP belongs
 * to the household), then to each guest's tags:
 *  - not_responded: household still has unanswered RSVPs (not started or partial)
 *  - responded:     household has answered everything
 *  - attending:     anyone in the household is coming to something
 *  - declined:      household answered everything and nobody is coming
 * One email per guest with an address; duplicate addresses get one email.
 */
export function selectRecipients(snapshot: WeddingSnapshot, filter: MessageRecipients): RecipientPreview {
  const responses = responsesMap(snapshot.responses);
  const recipients: Recipient[] = [];
  const missingEmail: RecipientPreview["missingEmail"] = [];
  const seen = new Set<string>();
  const households = new Set<string>();

  for (const h of snapshot.households) {
    const members = snapshot.guests.filter((g) => g.householdId === h.id);
    const state = householdRsvpState(members, snapshot.events, responses);
    const attending = householdIsAttending(members, snapshot.events, responses);
    const statusOk =
      filter.rsvpStatus === "any" ||
      (filter.rsvpStatus === "not_responded" && (state === "not_started" || state === "partial")) ||
      (filter.rsvpStatus === "responded" && state === "complete") ||
      (filter.rsvpStatus === "attending" && attending) ||
      (filter.rsvpStatus === "declined" && state === "complete" && !attending);
    if (!statusOk) continue;

    for (const g of members) {
      if (!inAudience(filter.audience, effectiveTagIds(g, members))) continue;
      const email = g.email?.trim().toLowerCase();
      if (!email) {
        // Children and plus-ones without an address are expected; only flag adults on the list.
        if (!g.isPlusOne && g.ageGroup === "adult") missingEmail.push({ guestId: g.id, name: `${g.firstName} ${g.lastName}` });
        continue;
      }
      households.add(h.id);
      if (seen.has(email)) continue;
      seen.add(email);
      recipients.push({ guestId: g.id, householdId: h.id, firstName: g.firstName, email });
    }
  }
  return { recipients, missingEmail, households: households.size };
}
