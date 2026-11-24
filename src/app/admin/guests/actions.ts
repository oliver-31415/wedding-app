"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { isValidEmail } from "@/lib/guests/status";
import { newId, newToken } from "@/lib/ids";
import { saveRsvp } from "@/lib/rsvp/save";
import { householdSlice, loadSnapshot } from "@/lib/snapshot";

type MemberInput = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  ageGroup: "adult" | "child";
  tagIds: string[];
};

type ParsedHouseholdForm = {
  envelopeName: string | null;
  plusOnesAllowed: number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  notes: string | null;
  members: MemberInput[];
};

function parseHouseholdForm(formData: FormData): { data: ParsedHouseholdForm; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const plusRaw = String(formData.get("plusOnesAllowed") ?? "0").trim();
  let plusOnesAllowed = 0;
  if (plusRaw !== "") {
    if (!/^\d+$/.test(plusRaw)) {
      errors.plusOnesAllowed = "Enter a whole number between 0 and 5.";
    } else {
      const n = Number.parseInt(plusRaw, 10);
      if (n < 0 || n > 5) errors.plusOnesAllowed = "Plus-ones allowed must be between 0 and 5.";
      else plusOnesAllowed = n;
    }
  }

  let rawMembers: unknown[] = [];
  const membersJson = formData.get("membersJson");
  if (typeof membersJson === "string") {
    try {
      const parsed = JSON.parse(membersJson);
      if (Array.isArray(parsed)) rawMembers = parsed;
    } catch {
      errors.members = "Could not read guest details. Please try again.";
    }
  }

  const members: MemberInput[] = [];
  if (rawMembers.length === 0) {
    errors.members = "A household needs at least one guest.";
  } else {
    rawMembers.forEach((raw, i) => {
      const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const firstName = typeof m.firstName === "string" ? m.firstName.trim() : "";
      const lastName = typeof m.lastName === "string" ? m.lastName.trim() : "";
      const emailRaw = typeof m.email === "string" ? m.email.trim() : "";
      const phoneRaw = typeof m.phone === "string" ? m.phone.trim() : "";
      const isChild = Boolean(m.isChild);
      const tagIds = Array.isArray(m.tagIds)
        ? [...new Set(m.tagIds.filter((t): t is string => typeof t === "string" && t.length > 0))]
        : [];
      const id = typeof m.id === "string" && m.id.trim() ? m.id.trim() : undefined;

      if (!firstName) errors[`member.${i}.firstName`] = "Enter a first name.";
      if (!lastName) errors[`member.${i}.lastName`] = "Enter a last name.";
      if (emailRaw && !isValidEmail(emailRaw)) errors[`member.${i}.email`] = "Enter a valid email address.";

      members.push({
        id,
        firstName,
        lastName,
        email: emailRaw || null,
        phone: phoneRaw || null,
        ageGroup: isChild ? "child" : "adult",
        tagIds,
      });
    });
  }

  return {
    data: {
      envelopeName: text(formData, "envelopeName"),
      plusOnesAllowed,
      addressLine1: text(formData, "addressLine1"),
      addressLine2: text(formData, "addressLine2"),
      city: text(formData, "city"),
      region: text(formData, "region"),
      postcode: text(formData, "postcode"),
      country: text(formData, "country"),
      notes: text(formData, "notes"),
      members,
    },
    errors,
  };
}

export async function createHouseholdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const { data, errors } = parseHouseholdForm(formData);
  if (Object.keys(errors).length > 0) {
    return fail("Please fix the highlighted fields.", errors);
  }

  const weddingTags = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id));
  const validTagIds = new Set(weddingTags.map((t) => t.id));

  const householdId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(schema.households).values({
      id: householdId,
      weddingId: wedding.id,
      envelopeName: data.envelopeName,
      plusOnesAllowed: data.plusOnesAllowed,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      region: data.region,
      postcode: data.postcode,
      country: data.country,
      notes: data.notes,
      inviteToken: newToken(),
    });

    for (const [position, m] of data.members.entries()) {
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
      const tagsToInsert = m.tagIds.filter((tid) => validTagIds.has(tid));
      if (tagsToInsert.length > 0) {
        await tx.insert(schema.guestTags).values(tagsToInsert.map((tagId) => ({ guestId, tagId })));
      }
    }
  });

  revalidatePath("/admin/guests");
  revalidateWedding(wedding.slug);
  redirect(`/admin/guests/${householdId}`);
}

export async function updateHouseholdAction(
  householdId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();

  const [existing] = await db
    .select({ id: schema.households.id })
    .from(schema.households)
    .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, wedding.id)))
    .limit(1);
  if (!existing) return fail("Household not found.");

  const existingGuests = await db
    .select()
    .from(schema.guests)
    .where(and(eq(schema.guests.householdId, householdId), eq(schema.guests.weddingId, wedding.id)));
  const existingMainIds = new Set(existingGuests.filter((g) => !g.isPlusOne).map((g) => g.id));
  const existingPlusOnes = existingGuests.filter((g) => g.isPlusOne);

  const { data, errors } = parseHouseholdForm(formData);
  if (!errors.plusOnesAllowed && data.plusOnesAllowed < existingPlusOnes.length) {
    errors.plusOnesAllowed = `Remove named plus-ones before lowering this below ${existingPlusOnes.length}.`;
  }
  if (Object.keys(errors).length > 0) {
    return fail("Please fix the highlighted fields.", errors);
  }

  const weddingTags = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id));
  const validTagIds = new Set(weddingTags.map((t) => t.id));

  await db.transaction(async (tx) => {
    await tx
      .update(schema.households)
      .set({
        envelopeName: data.envelopeName,
        plusOnesAllowed: data.plusOnesAllowed,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        region: data.region,
        postcode: data.postcode,
        country: data.country,
        notes: data.notes,
      })
      .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, wedding.id)));

    const keptMainIds = new Set<string>();

    for (const [position, m] of data.members.entries()) {
      const tagsToInsert = m.tagIds.filter((tid) => validTagIds.has(tid));

      if (m.id && existingMainIds.has(m.id)) {
        keptMainIds.add(m.id);
        await tx
          .update(schema.guests)
          .set({
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email,
            phone: m.phone,
            ageGroup: m.ageGroup,
            position,
          })
          .where(
            and(
              eq(schema.guests.id, m.id),
              eq(schema.guests.householdId, householdId),
              eq(schema.guests.weddingId, wedding.id),
            ),
          );
        await tx.delete(schema.guestTags).where(eq(schema.guestTags.guestId, m.id));
        if (tagsToInsert.length > 0) {
          await tx.insert(schema.guestTags).values(tagsToInsert.map((tagId) => ({ guestId: m.id!, tagId })));
        }
      } else {
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
        if (tagsToInsert.length > 0) {
          await tx.insert(schema.guestTags).values(tagsToInsert.map((tagId) => ({ guestId, tagId })));
        }
      }
    }

    const removedMainIds = [...existingMainIds].filter((id) => !keptMainIds.has(id));
    if (removedMainIds.length > 0) {
      await tx
        .delete(schema.guests)
        .where(
          and(
            inArray(schema.guests.id, removedMainIds),
            eq(schema.guests.householdId, householdId),
            eq(schema.guests.weddingId, wedding.id),
            eq(schema.guests.isPlusOne, false),
          ),
        );
    }

    for (const [idx, po] of existingPlusOnes.entries()) {
      await tx
        .update(schema.guests)
        .set({ position: data.members.length + idx })
        .where(and(eq(schema.guests.id, po.id), eq(schema.guests.weddingId, wedding.id)));
    }
  });

  revalidatePath("/admin/guests");
  revalidatePath(`/admin/guests/${householdId}`);
  revalidateWedding(wedding.slug);
  return ok("Household saved.");
}

export async function deleteHouseholdAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const householdId = text(formData, "householdId");
  if (!householdId) return;

  await db
    .delete(schema.households)
    .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, wedding.id)));

  revalidatePath("/admin/guests");
  revalidateWedding(wedding.slug);
  redirect("/admin/guests");
}

export async function removePlusOneAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const householdId = text(formData, "householdId");
  const guestId = text(formData, "guestId");
  if (!householdId || !guestId) return;

  await db
    .delete(schema.guests)
    .where(
      and(
        eq(schema.guests.id, guestId),
        eq(schema.guests.householdId, householdId),
        eq(schema.guests.weddingId, wedding.id),
        eq(schema.guests.isPlusOne, true),
      ),
    );

  revalidatePath("/admin/guests");
  revalidatePath(`/admin/guests/${householdId}`);
  revalidateWedding(wedding.slug);
}

export async function resetInviteLinkAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const householdId = text(formData, "householdId");
  if (!householdId) return;

  await db
    .update(schema.households)
    .set({ inviteToken: newToken() })
    .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, wedding.id)));

  revalidatePath(`/admin/guests/${householdId}`);
  revalidateWedding(wedding.slug);
}

export async function saveHostRsvpAction(
  householdId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();

  const snapshot = await loadSnapshot(wedding.id);
  const slice = householdSlice(snapshot, householdId);
  if (!slice) return fail("Household not found.");

  const rawJson = formData.get("rsvpJson");
  if (typeof rawJson !== "string") return fail("Missing RSVP data.");

  let parsed: {
    attendance?: { guestId: string; eventId: string; attending: boolean }[];
    answers?: { questionId: string; guestId: string | null; value: string }[];
    note?: string | null;
  };
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return fail("Could not read RSVP submission.");
  }

  const plusOnes = slice.guests
    .filter((g) => g.isPlusOne)
    .map((g) => ({ id: g.id, firstName: g.firstName, lastName: g.lastName }));

  const result = await saveRsvp({
    weddingId: wedding.id,
    householdId,
    source: "host",
    input: {
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
      answers: Array.isArray(parsed.answers) ? parsed.answers : [],
      plusOnes,
      note: typeof parsed.note === "string" ? parsed.note : null,
    },
  });

  if (!result.ok) {
    return fail(result.message ?? "Please check the highlighted answers.", result.errors);
  }

  revalidatePath("/admin/guests");
  revalidatePath(`/admin/guests/${householdId}`);
  revalidateWedding(wedding.slug);
  return ok("RSVP saved.");
}

export async function createTagInlineAction(
  rawName: string,
): Promise<{ ok: true; tag: { id: string; name: string }; existed: boolean } | { ok: false; error: string }> {
  const { wedding } = await requireHost();
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Enter a tag name." };
  if (name.length > 50) return { ok: false, error: "Keep tag names under 50 characters." };

  const existingTags = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id));

  const match = existingTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (match) {
    return { ok: true, tag: match, existed: true };
  }

  const id = newId();
  await db.insert(schema.tags).values({ id, weddingId: wedding.id, name });
  revalidatePath("/admin/guests/tags");
  revalidatePath("/admin/guests");
  revalidateWedding(wedding.slug);
  return { ok: true, tag: { id, name }, existed: false };
}
