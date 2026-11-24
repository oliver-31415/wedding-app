"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { revalidateWedding } from "@/lib/revalidate";
import { isValidSiteStyle, normalizeHexColor } from "@/lib/site-styles";

export async function saveDesignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const style = text(formData, "style");
  const accent = normalizeHexColor(text(formData, "accentColor"));
  const errors: Record<string, string> = {};
  if (!isValidSiteStyle(style)) errors.style = "Choose one of the styles.";
  if (!accent) errors.accentColor = "Enter a colour like #7c5c3e.";
  if (Object.keys(errors).length) return fail("Please fix the highlighted fields.", errors);

  await db.update(schema.weddings).set({ theme: style!, accentColor: accent! }).where(eq(schema.weddings.id, wedding.id));
  revalidateWedding();
  return ok("Design saved — your website now uses it.");
}
