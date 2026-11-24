import { normalizeName } from "@/lib/rsvp/lookup";
import type { GuestEventStatus, HouseholdRsvpState } from "@/lib/rsvp/model";

export type GuestListEventStatus = {
  eventId: string;
  eventName: string;
  status: GuestEventStatus;
};

export type GuestListMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  ageGroup: "adult" | "child";
  isPlusOne: boolean;
  tagIds: string[];
  eventStatuses: GuestListEventStatus[];
};

export type GuestListHousehold = {
  id: string;
  label: string;
  plusOnesAllowed: number;
  plusOnesRemaining: number;
  rsvpState: HouseholdRsvpState;
  members: GuestListMember[];
};

export type GuestFilter = {
  query?: string;
  tagId?: string;
  rsvpState?: HouseholdRsvpState | "all" | "";
};

/**
 * Filters households on /admin/guests by search query (name, household label or
 * email), tag, and household RSVP state.
 */
export function filterHouseholds(households: GuestListHousehold[], filter: GuestFilter): GuestListHousehold[] {
  const rawQuery = (filter.query ?? "").trim().toLowerCase();
  const normQuery = rawQuery ? normalizeName(rawQuery) : "";
  const tagId = filter.tagId && filter.tagId !== "all" ? filter.tagId : null;
  const rsvpState = filter.rsvpState && filter.rsvpState !== "all" ? filter.rsvpState : null;

  return households.filter((h) => {
    if (rsvpState && h.rsvpState !== rsvpState) return false;

    if (tagId && !h.members.some((m) => m.tagIds.includes(tagId))) return false;

    if (rawQuery) {
      const labelMatches =
        h.label.toLowerCase().includes(rawQuery) || (normQuery !== "" && normalizeName(h.label).includes(normQuery));
      if (labelMatches) return true;

      const memberMatches = h.members.some((m) => {
        const full = `${m.firstName} ${m.lastName}`;
        if (full.toLowerCase().includes(rawQuery)) return true;
        if (normQuery !== "" && normalizeName(full).includes(normQuery)) return true;
        if (m.email && m.email.toLowerCase().includes(rawQuery)) return true;
        return false;
      });
      if (!memberMatches) return false;
    }

    return true;
  });
}
