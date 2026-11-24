import { and, eq } from "drizzle-orm";
import {
  getViewerHouseholdGuests,
  getWeddingBySlug,
  getWeddingPages,
} from "@/components/site/site-data";
import { db, schema } from "@/db";
import { slugify } from "@/lib/forms";
import { buildEventIcs } from "@/lib/pages";
import { canSeeEvent } from "@/lib/event-visibility";
import { canViewPage, getViewer } from "@/lib/site-access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; eventId: string }> },
) {
  const { slug, eventId: rawEventId } = await context.params;
  const eventId = rawEventId.replace(/\.ics$/i, "");
  if (!eventId) return new Response("Not found", { status: 404 });

  const wedding = await getWeddingBySlug(slug);
  if (!wedding) return new Response("Not found", { status: 404 });

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) {
    return new Response("Not found", { status: 404 });
  }

  const [eventRows, pages, householdGuests] = await Promise.all([
    db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.id, eventId), eq(schema.events.weddingId, wedding.id)))
      .limit(1),
    getWeddingPages(wedding.id),
    getViewerHouseholdGuests(wedding.id, viewer.householdId),
  ]);

  const event = eventRows[0];
  if (!event || !event.startsAt) {
    return new Response("Not found", { status: 404 });
  }

  if (!viewer.isHost) {
    const schedulePage = pages.find((p) => p.type === "schedule");
    if (
      !schedulePage ||
      canViewPage(wedding, schedulePage, viewer, householdGuests) !== "ok"
    ) {
      return new Response("Not found", { status: 404 });
    }
    if (!canSeeEvent(event, viewer, householdGuests)) {
      return new Response("Not found", { status: 404 });
    }
  }

  const ics = buildEventIcs(wedding, {
    id: event.id,
    name: event.name,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venueName: event.venueName,
    address: event.address,
    dressCode: event.dressCode,
    description: event.description,
  });

  const filename = `${slugify(event.name) || "event"}.ics`;
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
