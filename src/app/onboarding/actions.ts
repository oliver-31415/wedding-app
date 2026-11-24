"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { validateWeddingDetailsInput } from "@/components/auth/validation";
import { db, schema } from "@/db";
import { getHostContext, requireVerifiedUser } from "@/lib/auth";
import { fail, text, type ActionState } from "@/lib/forms";
import { newId } from "@/lib/ids";

export async function createWeddingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  if (await getHostContext()) redirect("/admin");

  const partnerOne = text(formData, "partnerOne");
  const partnerTwo = text(formData, "partnerTwo");
  const date = text(formData, "date");
  const locationName = text(formData, "locationName");
  const slug = text(formData, "slug");

  const errors = validateWeddingDetailsInput({
    partnerOne,
    partnerTwo,
    date,
    slug,
    checkSlug: true,
  });
  if (Object.keys(errors).length > 0) {
    return fail("Please fix the highlighted fields.", errors);
  }

  const [existing] = await db
    .select({ id: schema.weddings.id })
    .from(schema.weddings)
    .where(eq(schema.weddings.slug, slug!))
    .limit(1);
  if (existing) {
    return fail("Please fix the highlighted fields.", {
      slug: "That web address is already taken. Try another one.",
    });
  }

  const weddingId = newId();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.weddings).values({
        id: weddingId,
        slug: slug!,
        partnerOne: partnerOne!,
        partnerTwo: partnerTwo!,
        date,
        locationName,
      });
      await tx.insert(schema.weddingMembers).values({
        weddingId,
        userId: user.id,
        role: "owner",
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("unique")) {
      return fail("Please fix the highlighted fields.", {
        slug: "That web address is already taken. Try another one.",
      });
    }
    throw err;
  }

  redirect("/admin");
}
