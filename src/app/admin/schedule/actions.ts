"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { deleteEvent } from "@/lib/cleanup";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { type ActionState, bool, fail, moveId, ok, readAudience, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { parseEventTimes } from "@/lib/pages";

function revalidateSchedule(weddingSlug: string, eventId?: string) {
  revalidatePath("/admin/schedule");
  if (eventId) revalidatePath(`/admin/schedule/${eventId}`);
  revalidatePath("/admin/rsvp");
  revalidateWedding();
}

export async function saveEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const eventId = text(formData, "eventId");

  const errors: Record<string, string> = {};
  const name = text(formData, "name");
  if (!name) errors.name = "Enter an event name.";

  const parsedTimes = parseEventTimes(
    text(formData, "date"),
    text(formData, "startTime"),
    text(formData, "endTime"),
  );
  if (!parsedTimes.ok) {
    Object.assign(errors, parsedTimes.errors);
  }

  const parsedAudience = readAudience(formData, "audience");
  if ("error" in parsedAudience) {
    errors.audience = parsedAudience.error;
  }

  if (Object.keys(errors).length > 0 || !parsedTimes.ok || "error" in parsedAudience) {
    return fail("Please fix the highlighted fields.", errors);
  }

  const venueName = text(formData, "venueName");
  const address = text(formData, "address");
  const dressCode = text(formData, "dressCode");
  const description = text(formData, "description");
  const rsvpEnabled = bool(formData, "rsvpEnabled");
  const guestsOnly = bool(formData, "guestsOnly");

  if (eventId) {
    const [existing] = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(and(eq(schema.events.id, eventId), eq(schema.events.weddingId, wedding.id)))
      .limit(1);
    if (!existing) return fail("Event not found.");

    await db
      .update(schema.events)
      .set({
        name: name!,
        startsAt: parsedTimes.startsAt,
        endsAt: parsedTimes.endsAt,
        venueName,
        address,
        dressCode,
        description,
        audience: parsedAudience,
        guestsOnly,
        rsvpEnabled,
      })
      .where(and(eq(schema.events.id, eventId), eq(schema.events.weddingId, wedding.id)));

    revalidateSchedule(wedding.slug, eventId);
    return ok("Event saved.");
  }

  const existing = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.weddingId, wedding.id));

  const id = newId();
  await db.insert(schema.events).values({
    id,
    weddingId: wedding.id,
    name: name!,
    startsAt: parsedTimes.startsAt,
    endsAt: parsedTimes.endsAt,
    venueName,
    address,
    dressCode,
    description,
    audience: parsedAudience,
    guestsOnly,
    rsvpEnabled,
    position: existing.length,
  });

  revalidateSchedule(wedding.slug, id);
  redirect("/admin/schedule");
}

export async function reorderEventAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const existing = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.weddingId, wedding.id))
    .orderBy(asc(schema.events.position), asc(schema.events.createdAt));

  const ordered = moveId(
    existing.map((e) => e.id),
    id,
    direction,
  );
  await Promise.all(
    ordered.map((eid, position) =>
      db
        .update(schema.events)
        .set({ position })
        .where(and(eq(schema.events.id, eid), eq(schema.events.weddingId, wedding.id))),
    ),
  );

  revalidateSchedule(wedding.slug);
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const redirectTo = text(formData, "redirectTo");
  if (!id) return;

  // Archives the event's RSVP questions (keeping their answers) before deleting it.
  await deleteEvent(wedding.id, id);

  const remaining = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.weddingId, wedding.id))
    .orderBy(asc(schema.events.position), asc(schema.events.createdAt));

  await Promise.all(
    remaining.map((e, position) =>
      db
        .update(schema.events)
        .set({ position })
        .where(and(eq(schema.events.id, e.id), eq(schema.events.weddingId, wedding.id))),
    ),
  );

  revalidateSchedule(wedding.slug);
  if (redirectTo === "list") redirect("/admin/schedule");
}
