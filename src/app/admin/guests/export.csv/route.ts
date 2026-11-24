import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { buildGuestExportCsv } from "@/lib/guests/csv";
import { loadSnapshot } from "@/lib/snapshot";

export async function GET() {
  const { wedding } = await requireHost();

  const [snapshot, fullHouseholds, fullGuests, allTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db.select().from(schema.households).where(eq(schema.households.weddingId, wedding.id)),
    db
      .select({ id: schema.guests.id, phone: schema.guests.phone })
      .from(schema.guests)
      .where(eq(schema.guests.weddingId, wedding.id)),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const phoneByGuest = new Map(fullGuests.map((g) => [g.id, g.phone]));

  const csv = buildGuestExportCsv({
    households: fullHouseholds.map((h) => ({
      id: h.id,
      envelopeName: h.envelopeName,
      plusOnesAllowed: h.plusOnesAllowed,
      addressLine1: h.addressLine1,
      addressLine2: h.addressLine2,
      city: h.city,
      region: h.region,
      postcode: h.postcode,
      country: h.country,
      notes: h.notes,
    })),
    guests: snapshot.guests.map((g) => ({
      ...g,
      phone: phoneByGuest.get(g.id) ?? null,
    })),
    tags: allTags,
    events: snapshot.events,
    questions: snapshot.questions,
    responses: snapshot.responses,
    answers: snapshot.answers,
  });

  const safeSlug = wedding.slug.replace(/[^a-z0-9-]/gi, "") || "wedding";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guests-${safeSlug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
