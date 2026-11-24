import "server-only";
import { usableAnswers } from "@/lib/rsvp/model";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  householdRsvpState,
  responsesMap,
  type HouseholdRsvpState,
  type SnapGuest,
  type SnapHousehold,
  type SnapQuestion,
} from "@/lib/rsvp/model";
import { householdSlice, loadSnapshot } from "@/lib/snapshot";
import { buildInitialFormState, type EventDetail, type GuestFormState } from "./form-model";
import { buildConfirmationSummary, type ConfirmationSummary } from "./summary";

export async function loadEventDetails(weddingId: string): Promise<EventDetail[]> {
  const rows = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.weddingId, weddingId))
    .orderBy(asc(schema.events.position), asc(schema.events.createdAt));

  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    audience: e.audience,
    rsvpEnabled: e.rsvpEnabled,
    position: e.position,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venueName,
    address: e.address,
  }));
}

export async function loadLatestHouseholdNote(
  weddingId: string,
  householdId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ note: schema.rsvpActivity.note })
    .from(schema.rsvpActivity)
    .where(
      and(
        eq(schema.rsvpActivity.weddingId, weddingId),
        eq(schema.rsvpActivity.householdId, householdId),
        // Only the guest's own notes — notes a host typed while editing are private.
        eq(schema.rsvpActivity.source, "guest"),
      ),
    )
    .orderBy(desc(schema.rsvpActivity.createdAt), sql`rowid DESC`)
    .limit(1);

  return row?.note ?? null;
}

export type LoadedHouseholdRsvp = {
  household: SnapHousehold;
  guests: SnapGuest[];
  mainGuests: SnapGuest[];
  events: EventDetail[];
  questions: SnapQuestion[];
  latestNote: string | null;
  state: HouseholdRsvpState;
  summary: ConfirmationSummary;
  initialFormState: GuestFormState;
};

export async function loadHouseholdRsvpData(
  weddingId: string,
  householdId: string,
): Promise<LoadedHouseholdRsvp | null> {
  const [snapshot, events, latestNote] = await Promise.all([
    loadSnapshot(weddingId),
    loadEventDetails(weddingId),
    loadLatestHouseholdNote(weddingId, householdId),
  ]);

  const slice = householdSlice(snapshot, householdId);
  if (!slice) return null;

  const respMap = responsesMap(slice.responses);
  const state = householdRsvpState(slice.guests, events, respMap);
  const summary = buildConfirmationSummary({
    household: slice.household,
    guests: slice.guests,
    events,
    questions: snapshot.questions,
    responses: slice.responses,
    answers: slice.answers,
    note: latestNote,
  });
  const initialFormState = buildInitialFormState(
    slice.guests,
    slice.responses,
    usableAnswers(slice.answers, snapshot.questions),
    latestNote,
  );

  return {
    household: slice.household,
    guests: slice.guests,
    mainGuests: slice.guests.filter((g) => !g.isPlusOne),
    events,
    questions: snapshot.questions,
    latestNote,
    state,
    summary,
    initialFormState,
  };
}
