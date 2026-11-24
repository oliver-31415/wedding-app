"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateWedding } from "@/lib/revalidate";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { bool, fail, ok, text, type ActionState } from "@/lib/forms";
import { validateRsvpSettingsInput } from "@/lib/rsvp-admin/validation";

export async function saveRsvpSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();

  const result = validateRsvpSettingsInput({
    rsvpOpen: bool(formData, "rsvpOpen"),
    rsvpDeadline: text(formData, "rsvpDeadline"),
    rsvpAllowEdits: bool(formData, "rsvpAllowEdits"),
    rsvpClosedMessage: text(formData, "rsvpClosedMessage"),
  });

  if (!result.ok) {
    return fail(result.message, result.errors);
  }

  await db
    .update(schema.weddings)
    .set({
      rsvpOpen: result.value.rsvpOpen,
      rsvpDeadline: result.value.rsvpDeadline,
      rsvpAllowEdits: result.value.rsvpAllowEdits,
      rsvpClosedMessage: result.value.rsvpClosedMessage,
    })
    .where(eq(schema.weddings.id, wedding.id));

  revalidatePath("/admin/rsvp");
  revalidatePath("/admin/rsvp/settings");
  revalidateWedding(wedding.slug);
  return ok("RSVP settings saved.");
}
