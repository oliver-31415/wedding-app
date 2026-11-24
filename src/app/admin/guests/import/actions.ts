"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { parseGuestCsv, selectImportHouseholds } from "@/lib/guests/csv";
import { newId, newToken } from "@/lib/ids";
import { householdLabel } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";

export type ImportSummary = {
  householdsCreated: number;
  guestsCreated: number;
  tagsCreated: number;
  skippedDuplicates: number;
  skippedErrors: number;
};

export type ImportActionState =
  | { ok: true; summary: ImportSummary }
  | { ok: false; message: string }
  | null;

export async function confirmImportAction(_prev: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const { wedding } = await requireHost();

  const csvText = formData.get("csvText");
  if (typeof csvText !== "string" || !csvText.trim()) {
    return { ok: false, message: "Upload a CSV file before importing." };
  }

  const includedRows = new Set<number>();
  const rawIncluded = formData.get("includedDuplicateRows");
  if (typeof rawIncluded === "string" && rawIncluded.trim()) {
    try {
      const arr = JSON.parse(rawIncluded);
      if (Array.isArray(arr)) {
        for (const n of arr) if (typeof n === "number" && Number.isInteger(n)) includedRows.add(n);
      }
    } catch {
      return { ok: false, message: "Could not read duplicate selections." };
    }
  }

  const [snapshot, existingTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db.select({ id: schema.tags.id, name: schema.tags.name }).from(schema.tags).where(eq(schema.tags.weddingId, wedding.id)),
  ]);

  const guestsByHousehold = new Map<string, typeof snapshot.guests>();
  for (const g of snapshot.guests) {
    const list = guestsByHousehold.get(g.householdId);
    if (list) list.push(g);
    else guestsByHousehold.set(g.householdId, [g]);
  }
  const labelByHousehold = new Map<string, string>();
  for (const h of snapshot.households) {
    labelByHousehold.set(h.id, householdLabel(h, guestsByHousehold.get(h.id) ?? []));
  }

  const existingGuestRefs = snapshot.guests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    householdLabel: labelByHousehold.get(g.householdId) ?? "",
  }));

  const parsed = parseGuestCsv(csvText, existingGuestRefs);
  if (parsed.fatalError) return { ok: false, message: parsed.fatalError };

  const selected = selectImportHouseholds(parsed, includedRows, existingTags);
  if (selected.households.length === 0 || selected.guestCount === 0) {
    return { ok: false, message: "There are no guests selected to import." };
  }

  let tagsCreated = 0;

  await db.transaction(async (tx) => {
    const currentTags = await tx
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id));

    const tagIdByLower = new Map<string, string>(currentTags.map((t) => [t.name.trim().toLowerCase(), t.id]));

    for (const tagName of selected.newTagNames) {
      const lower = tagName.toLowerCase();
      if (tagIdByLower.has(lower)) continue;
      const id = newId();
      await tx.insert(schema.tags).values({ id, weddingId: wedding.id, name: tagName });
      tagIdByLower.set(lower, id);
      tagsCreated++;
    }

    for (const h of selected.households) {
      const householdId = newId();
      await tx.insert(schema.households).values({
        id: householdId,
        weddingId: wedding.id,
        envelopeName: h.envelopeName,
        plusOnesAllowed: h.plusOnesAllowed,
        addressLine1: h.addressLine1,
        addressLine2: h.addressLine2,
        city: h.city,
        region: h.region,
        postcode: h.postcode,
        country: h.country,
        notes: h.notes,
        inviteToken: newToken(),
      });

      for (const [position, m] of h.members.entries()) {
        const guestId = newId();
        await tx.insert(schema.guests).values({
          id: guestId,
          weddingId: wedding.id,
          householdId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: m.phone,
          ageGroup: m.ageGroup,
          isPlusOne: false,
          position,
        });

        const tagIds = [...new Set(m.tags.map((name) => tagIdByLower.get(name.toLowerCase())).filter((id): id is string => Boolean(id)))];
        if (tagIds.length > 0) {
          await tx.insert(schema.guestTags).values(tagIds.map((tagId) => ({ guestId, tagId })));
        }
      }
    }
  });

  revalidatePath("/admin/guests");
  revalidatePath("/admin/guests/tags");
  revalidateWedding();

  return {
    ok: true,
    summary: {
      householdsCreated: selected.households.length,
      guestsCreated: selected.guestCount,
      tagsCreated,
      skippedDuplicates: selected.skippedDuplicates,
      skippedErrors: parsed.errors.length,
    },
  };
}
