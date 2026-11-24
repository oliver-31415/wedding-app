"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { bool, fail, ok, text, type ActionState } from "@/lib/forms";

export async function togglePublishAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const published = bool(formData, "published");

  await db
    .update(schema.weddings)
    .set({ published })
    .where(eq(schema.weddings.id, wedding.id));

  revalidatePath("/admin", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/settings/site-access");
  revalidateWedding();
  return ok(published ? "Your wedding site is now published." : "Your wedding site is now a draft.");
}

export async function saveSitePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const sitePassword = text(formData, "sitePassword");

  if (!sitePassword) {
    return fail("Enter a site password.", { sitePassword: "Enter a site password." });
  }
  if (sitePassword.length > 100) {
    return fail("Keep the site password under 100 characters.", {
      sitePassword: "Keep the site password under 100 characters.",
    });
  }

  await db
    .update(schema.weddings)
    .set({ sitePassword })
    .where(eq(schema.weddings.id, wedding.id));

  revalidatePath("/admin/settings/site-access");
  revalidateWedding();
  return ok("Site password saved.");
}

export async function removeSitePasswordAction(): Promise<void> {
  const { wedding } = await requireHost();

  await db
    .update(schema.weddings)
    .set({ sitePassword: null })
    .where(eq(schema.weddings.id, wedding.id));

  revalidatePath("/admin/settings/site-access");
  revalidateWedding();
}

export async function saveSearchVisibilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const searchVisible = bool(formData, "searchVisible");

  await db
    .update(schema.weddings)
    .set({ searchVisible })
    .where(eq(schema.weddings.id, wedding.id));

  revalidatePath("/admin/settings/site-access");
  revalidateWedding();
  return ok(
    searchVisible
      ? "Search engines can now index your wedding site."
      : "Search engines are asked not to show your wedding site.",
  );
}
