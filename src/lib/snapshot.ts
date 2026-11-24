import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** `db` or a transaction — anything that can run selects. */
export type Reader = Pick<typeof db, "select">;
import type { SnapGuest } from "@/lib/rsvp/model";
import type { WeddingSnapshot } from "@/lib/stats";

/**
 * Everything the RSVP rules and stats need for one wedding, in one go.
 * Weddings are small (hundreds of guests), so loading it whole keeps every
 * screen's numbers consistent and the code simple.
 */
export async function loadSnapshot(weddingId: string, reader: Reader = db): Promise<WeddingSnapshot> {
  const db = reader;
  const [households, guests, guestTags, events, questions, responses, answers] = await Promise.all([
    db.select().from(schema.households).where(eq(schema.households.weddingId, weddingId)),
    db
      .select()
      .from(schema.guests)
      .where(eq(schema.guests.weddingId, weddingId))
      .orderBy(asc(schema.guests.position), asc(schema.guests.createdAt)),
    db
      .select({ guestId: schema.guestTags.guestId, tagId: schema.guestTags.tagId })
      .from(schema.guestTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.guestTags.tagId))
      .where(eq(schema.tags.weddingId, weddingId)),
    db.select().from(schema.events).where(eq(schema.events.weddingId, weddingId)),
    db.select().from(schema.questions).where(eq(schema.questions.weddingId, weddingId)),
    db.select().from(schema.eventResponses).where(eq(schema.eventResponses.weddingId, weddingId)),
    db.select().from(schema.answers).where(eq(schema.answers.weddingId, weddingId)),
  ]);

  const tagsByGuest = new Map<string, string[]>();
  for (const { guestId, tagId } of guestTags) {
    const list = tagsByGuest.get(guestId);
    if (list) list.push(tagId);
    else tagsByGuest.set(guestId, [tagId]);
  }

  return {
    households: households.map((h) => ({ id: h.id, envelopeName: h.envelopeName, plusOnesAllowed: h.plusOnesAllowed })),
    guests: guests.map(
      (g): SnapGuest => ({
        id: g.id,
        householdId: g.householdId,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        ageGroup: g.ageGroup,
        isPlusOne: g.isPlusOne,
        tagIds: tagsByGuest.get(g.id) ?? [],
      }),
    ),
    events: events.map((e) => ({ id: e.id, name: e.name, audience: e.audience, rsvpEnabled: e.rsvpEnabled, position: e.position })),
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      options: q.options,
      required: q.required,
      scope: q.scope,
      eventId: q.eventId,
      parentQuestionId: q.parentQuestionId,
      parentOptionId: q.parentOptionId,
      audience: q.audience,
      archived: q.archived,
      position: q.position,
    })),
    responses: responses.map((r) => ({ guestId: r.guestId, eventId: r.eventId, attending: r.attending })),
    answers: answers.map((a) => ({ questionId: a.questionId, guestId: a.guestId, householdId: a.householdId, value: a.value })),
  };
}

/** The slice of a snapshot belonging to one household. */
export function householdSlice(snapshot: WeddingSnapshot, householdId: string) {
  const household = snapshot.households.find((h) => h.id === householdId);
  if (!household) return null;
  const guests = snapshot.guests.filter((g) => g.householdId === householdId);
  const ids = new Set(guests.map((g) => g.id));
  return {
    household,
    guests,
    responses: snapshot.responses.filter((r) => ids.has(r.guestId)),
    answers: snapshot.answers.filter((a) => (a.guestId ? ids.has(a.guestId) : a.householdId === householdId)),
  };
}
