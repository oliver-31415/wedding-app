"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { isAllowedCurrency, isAllowedTimeZone } from "@/components/admin/settings/helpers";
import { validateWeddingDetailsInput, validateWeddingSlug } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { fail, ok, text, type ActionState } from "@/lib/forms";

export async function updateGeneralAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();

  const partnerOne = text(formData, "partnerOne");
  const partnerTwo = text(formData, "partnerTwo");
  const date = text(formData, "date");
  const locationName = text(formData, "locationName");
  const timeZone = text(formData, "timeZone") ?? wedding.timeZone;
  const currency = text(formData, "currency") ?? wedding.currency;

  const errors = validateWeddingDetailsInput({ partnerOne, partnerTwo, date });
  if (!isAllowedTimeZone(timeZone, wedding.timeZone)) {
    errors.timeZone = "Choose a time zone from the list.";
  }
  if (!isAllowedCurrency(currency, wedding.currency)) {
    errors.currency = "Choose a currency from the list.";
  }
  if (Object.keys(errors).length > 0) {
    return fail("Please fix the highlighted fields.", errors);
  }

  await db
    .update(schema.weddings)
    .set({
      partnerOne: partnerOne!,
      partnerTwo: partnerTwo!,
      date,
      locationName,
      timeZone,
      currency,
    })
    .where(eq(schema.weddings.id, wedding.id));

  revalidatePath("/admin", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidateWedding(wedding.slug);
  return ok("Wedding details saved.");
}

export async function updateSlugAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding, role } = await requireHost();
  if (role !== "owner") {
    return fail("Only the wedding owner can change the web address.");
  }

  const slug = text(formData, "slug");
  const slugError = validateWeddingSlug(slug);
  if (slugError) {
    return fail("Please fix the highlighted field.", { slug: slugError });
  }

  if (slug === wedding.slug) {
    return ok("Web address saved.");
  }

  const [existing] = await db
    .select({ id: schema.weddings.id })
    .from(schema.weddings)
    .where(and(eq(schema.weddings.slug, slug!), ne(schema.weddings.id, wedding.id)))
    .limit(1);
  if (existing) {
    return fail("Please fix the highlighted field.", {
      slug: "That web address is already taken. Try another one.",
    });
  }

  try {
    await db
      .update(schema.weddings)
      .set({ slug: slug! })
      .where(eq(schema.weddings.id, wedding.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("unique")) {
      return fail("Please fix the highlighted field.", {
        slug: "That web address is already taken. Try another one.",
      });
    }
    throw err;
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/site-access");
  revalidateWedding(slug!, wedding.slug);
  return ok("Web address updated.");
}
