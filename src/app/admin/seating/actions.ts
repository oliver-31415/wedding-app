"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { type ActionState, fail, int, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { revalidateWedding } from "@/lib/revalidate";

export async function saveTableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const capacity = int(formData, "capacity", -1);
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter a table name or number.";
  if (capacity < 1 || capacity > 100) errors.capacity = "Enter how many seats (1–100).";
  if (Object.keys(errors).length > 0) return fail("Please fix the highlighted fields.", errors);

  if (id) {
    await db
      .update(schema.seatingTables)
      .set({ name: name!, capacity, notes: text(formData, "notes") })
      .where(and(eq(schema.seatingTables.id, id), eq(schema.seatingTables.weddingId, wedding.id)));
    revalidateWedding();
    return ok("Table saved.");
  }
  const existing = await db
    .select({ id: schema.seatingTables.id })
    .from(schema.seatingTables)
    .where(eq(schema.seatingTables.weddingId, wedding.id));
  await db.insert(schema.seatingTables).values({
    id: newId(),
    weddingId: wedding.id,
    name: name!,
    capacity,
    notes: text(formData, "notes"),
    position: existing.length,
  });
  revalidateWedding();
  return ok(`Added ${name}.`);
}

export async function deleteTableAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  // Seat assignments at this table go with it (ON DELETE CASCADE); those guests become unseated.
  await db.delete(schema.seatingTables).where(and(eq(schema.seatingTables.id, id), eq(schema.seatingTables.weddingId, wedding.id)));
  const rest = await db
    .select({ id: schema.seatingTables.id })
    .from(schema.seatingTables)
    .where(eq(schema.seatingTables.weddingId, wedding.id))
    .orderBy(asc(schema.seatingTables.position), asc(schema.seatingTables.createdAt));
  await Promise.all(
    rest.map((t, position) =>
      db
        .update(schema.seatingTables)
        .set({ position })
        .where(and(eq(schema.seatingTables.id, t.id), eq(schema.seatingTables.weddingId, wedding.id))),
    ),
  );
  revalidateWedding();
}

/** Seats one or more guests (`guestId` repeated) at a table, moving them if already seated. */
export async function seatGuestsAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const tableId = text(formData, "tableId");
  const guestIds = formData.getAll("guestId").map(String).filter(Boolean);
  if (!tableId || guestIds.length === 0) return;

  const [table] = await db
    .select({ id: schema.seatingTables.id })
    .from(schema.seatingTables)
    .where(and(eq(schema.seatingTables.id, tableId), eq(schema.seatingTables.weddingId, wedding.id)))
    .limit(1);
  if (!table) return;
  const guests = await db
    .select({ id: schema.guests.id })
    .from(schema.guests)
    .where(and(inArray(schema.guests.id, guestIds), eq(schema.guests.weddingId, wedding.id)));
  if (guests.length === 0) return;

  for (const g of guests) {
    await db
      .insert(schema.seatAssignments)
      .values({ guestId: g.id, weddingId: wedding.id, tableId: table.id })
      .onConflictDoUpdate({ target: schema.seatAssignments.guestId, set: { tableId: table.id } });
  }
  revalidateWedding();
}

export async function unseatGuestAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const guestId = text(formData, "guestId");
  if (!guestId) return;
  await db
    .delete(schema.seatAssignments)
    .where(and(eq(schema.seatAssignments.guestId, guestId), eq(schema.seatAssignments.weddingId, wedding.id)));
  revalidateWedding();
}
