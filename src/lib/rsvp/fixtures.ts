// Test fixtures shared by the RSVP and stats tests.
import type { SnapEvent, SnapGuest, SnapHousehold, SnapQuestion } from "./model";

export function guest(id: string, householdId: string, over: Partial<SnapGuest> = {}): SnapGuest {
  return {
    id,
    householdId,
    firstName: id[0].toUpperCase() + id.slice(1),
    lastName: "Jones",
    email: `${id}@example.com`,
    ageGroup: "adult",
    isPlusOne: false,
    tagIds: [],
    ...over,
  };
}

export function household(id: string, over: Partial<SnapHousehold> = {}): SnapHousehold {
  return { id, envelopeName: null, plusOnesAllowed: 0, ...over };
}

export function event(id: string, over: Partial<SnapEvent> = {}): SnapEvent {
  return { id, name: id, audience: { mode: "all" }, rsvpEnabled: true, position: 0, ...over };
}

export function question(id: string, over: Partial<SnapQuestion> = {}): SnapQuestion {
  return {
    id,
    type: "choice",
    label: id,
    options: [],
    required: false,
    scope: "guest",
    eventId: null,
    parentQuestionId: null,
    parentOptionId: null,
    audience: { mode: "all" },
    archived: false,
    position: 0,
    ...over,
  };
}
