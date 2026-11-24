import { daysUntil, endOfDay, formatDateLong, formatDateShort, formatTime } from "@/lib/dates";
import {
  guestEventStatus,
  guestName,
  householdLabel,
  householdRsvpState,
  responsesMap,
  rsvpEventsFor,
  type HouseholdRsvpState,
  type RsvpSettings,
  type SnapGuest,
  rsvpWindow,
} from "@/lib/rsvp/model";
import type { WeddingSnapshot } from "@/lib/stats";

/**
 * Counts guests who were invited to at least one RSVP event and declined
 * every RSVP event they were invited to.
 * Derived from the snapshot using `guestEventStatus` so it stays in lockstep
 * with `computeStats`.
 */
export function countDeclinedAllInvited(snapshot: WeddingSnapshot): number {
  const responses = responsesMap(snapshot.responses);
  const byHousehold = groupBy(snapshot.guests, (g) => g.householdId);
  let declinedAll = 0;

  for (const guest of snapshot.guests) {
    const members = byHousehold.get(guest.householdId) ?? [];
    let invitedCount = 0;
    let declinedCount = 0;
    for (const event of snapshot.events) {
      const status = guestEventStatus(guest, event, members, responses);
      if (status === "not_invited") continue;
      invitedCount++;
      if (status === "declined") declinedCount++;
    }
    if (invitedCount > 0 && declinedCount === invitedCount) {
      declinedAll++;
    }
  }

  return declinedAll;
}

export type PendingHousehold = {
  householdId: string;
  label: string;
  state: Extract<HouseholdRsvpState, "not_started" | "partial">;
  missingSummary: string;
};

/**
 * Households invited to at least one RSVP event whose replies are not yet complete,
 * along with a concise description of who/what is missing.
 */
export function getPendingHouseholds(snapshot: WeddingSnapshot): PendingHousehold[] {
  const responses = responsesMap(snapshot.responses);
  const byHousehold = groupBy(snapshot.guests, (g) => g.householdId);
  const pending: PendingHousehold[] = [];

  for (const household of snapshot.households) {
    const members = byHousehold.get(household.id) ?? [];
    const state = householdRsvpState(members, snapshot.events, responses);
    if (state !== "not_started" && state !== "partial") continue;

    const missingPerGuest: { guest: SnapGuest; eventNames: string[] }[] = [];
    for (const guest of members) {
      const events = rsvpEventsFor(guest, snapshot.events, members);
      const missingEvents = events
        .filter((ev) => guestEventStatus(guest, ev, members, responses) === "pending")
        .map((ev) => ev.name);
      if (missingEvents.length > 0) {
        missingPerGuest.push({ guest, eventNames: missingEvents });
      }
    }

    const missingSummary = formatMissingSummary(state, members, missingPerGuest);
    pending.push({
      householdId: household.id,
      label: householdLabel(household, members),
      state,
      missingSummary,
    });
  }

  return pending.sort((a, b) => {
    if (a.state !== b.state) return a.state === "partial" ? -1 : 1;
    return a.label.localeCompare(b.label, "en-AU");
  });
}

function formatMissingSummary(
  state: "not_started" | "partial",
  members: SnapGuest[],
  missingPerGuest: { guest: SnapGuest; eventNames: string[] }[],
): string {
  if (missingPerGuest.length === 0) return "Awaiting reply";

  if (state === "not_started") {
    const allEvents = Array.from(
      new Set(missingPerGuest.flatMap((m) => m.eventNames)),
    );
    const guestCount = missingPerGuest.length;
    const prefix =
      guestCount === 1
        ? "Hasn't replied yet"
        : `${guestCount} guests haven't replied yet`;
    return allEvents.length > 0 ? `${prefix} · ${allEvents.join(", ")}` : prefix;
  }

  const sameSurname = new Set(members.map((m) => m.lastName)).size === 1;
  const parts = missingPerGuest.map(({ guest, eventNames }) => {
    const name = sameSurname && members.length > 1 ? guest.firstName : guestName(guest);
    return `${name} (${eventNames.join(", ")})`;
  });
  return `Waiting on ${parts.join("; ")}`;
}

export type DeadlineLine = {
  open: boolean;
  headline: string;
  detail: string | null;
  noDeadline: boolean;
};

/**
 * Summary line for the Responses page header.
 */
export function describeDeadlineLine(
  settings: RsvpSettings,
  now = Date.now(),
): DeadlineLine {
  const win = rsvpWindow(settings, now);
  if (!win.open) {
    return {
      open: false,
      headline: "RSVPs are closed",
      detail:
        win.reason === "deadline_passed" && settings.rsvpDeadline
          ? `Deadline passed on ${formatDateLong(settings.rsvpDeadline)}`
          : "Turned off in RSVP settings",
      noDeadline: false,
    };
  }

  if (!settings.rsvpDeadline) {
    return {
      open: true,
      headline: "No deadline set",
      detail: null,
      noDeadline: true,
    };
  }

  const days = daysUntil(settings.rsvpDeadline, settings.timeZone, now);
  const daysText =
    days <= 0 ? "closes today" : days === 1 ? "1 day left" : `${days} days left`;

  return {
    open: true,
    headline: `RSVPs close on ${formatDateLong(settings.rsvpDeadline)}`,
    detail: daysText,
    noDeadline: false,
  };
}

export type RsvpWindowStatus = {
  open: boolean;
  headline: string;
  detail: string | null;
};

/**
 * Full status sentence for the Settings page using `rsvpWindow` and `endOfDay`.
 */
export function describeRsvpWindowStatus(
  settings: RsvpSettings,
  now = Date.now(),
): RsvpWindowStatus {
  const win = rsvpWindow(settings, now);
  if (!win.open) {
    if (win.reason === "closed_by_host") {
      return {
        open: false,
        headline: "RSVPs are currently closed.",
        detail: "Turn on “Accept RSVPs” to let guests reply.",
      };
    }
    const deadline = settings.rsvpDeadline!;
    const closeTime = formatTimeInZone(endOfDay(deadline, settings.timeZone), settings.timeZone);
    return {
      open: false,
      headline: `RSVPs closed at ${closeTime} on ${formatDateLong(deadline)} (${settings.timeZone} time).`,
      detail: "Change or clear the deadline to reopen RSVPs.",
    };
  }

  const editNote = settings.rsvpAllowEdits
    ? "Guests who have already replied can update their RSVP."
    : "Once submitted, guests can't edit their RSVP.";

  if (win.closesAt !== null && settings.rsvpDeadline) {
    const closeTime = formatTimeInZone(win.closesAt, settings.timeZone);
    return {
      open: true,
      headline: `Guests can RSVP until ${closeTime} on ${formatDateLong(settings.rsvpDeadline)} (${settings.timeZone} time).`,
      detail: editNote,
    };
  }

  return {
    open: true,
    headline: "Guests can RSVP now. No deadline is set.",
    detail: editNote,
  };
}

function instantToWall(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatTimeInZone(instant: number, timeZone: string): string {
  return formatTime(instantToWall(instant, timeZone));
}

/**
 * Formats a unix ms timestamp into a readable absolute date & time in the wedding's
 * time zone using `src/lib/dates.ts` helpers, e.g. "24 Nov 2026, 3:45 pm".
 */
export function formatInstantInZone(instant: number, timeZone: string): string {
  const wall = instantToWall(instant, timeZone);
  return `${formatDateShort(wall)}, ${formatTime(wall)}`;
}

export function currentTimestamp(): number {
  return Date.now();
}

export function describeActivityAction(
  source: "guest" | "host",
  kind: "first" | "update",
): string {
  if (source === "host") return "RSVP changed by a host";
  return kind === "first" ? "replied for the first time" : "updated their RSVP";
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}
