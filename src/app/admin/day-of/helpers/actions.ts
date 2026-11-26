"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-layout";
import { returnPath } from "@/app/admin/day-of/helpers/guest-options";
import { type ActionState, fail, moveId, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { revalidateWedding } from "@/lib/revalidate";
import { firstName, newHelperToken } from "@/lib/run-sheet";
import { helperUrl, loadAssignments, loadHelpers, type Helper } from "@/lib/run-sheet-data";

type Wedding = typeof schema.weddings.$inferSelect;

function revalidateHelpers() {
  revalidatePath("/admin/day-of", "layout");
  revalidateWedding();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveHelperAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const helperId = text(formData, "helperId");
  const name = text(formData, "name");
  const role = text(formData, "role");
  const email = text(formData, "email");
  const phone = text(formData, "phone");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter their name.";
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter an email address like jess@example.com.";
  if (Object.keys(errors).length || !name) return fail("Please fix the highlighted fields.", errors);

  if (helperId) {
    const updated = await db
      .update(schema.helpers)
      .set({ name, role, email, phone })
      .where(and(eq(schema.helpers.id, helperId), eq(schema.helpers.weddingId, wedding.id)))
      .returning({ id: schema.helpers.id });
    if (!updated.length) return fail("That helper has been removed.");
  } else {
    const existing = await db
      .select({ id: schema.helpers.id })
      .from(schema.helpers)
      .where(eq(schema.helpers.weddingId, wedding.id));
    await db.insert(schema.helpers).values({
      id: newId(),
      weddingId: wedding.id,
      name,
      role,
      email,
      phone,
      token: newHelperToken(),
      position: existing.length,
    });
  }

  revalidateHelpers();
  redirect(returnPath(text(formData, "returnTo")));
}

/** Deletes a helper; they come off their jobs (the jobs stay). */
export async function deleteHelperAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.helpers).where(and(eq(schema.helpers.id, id), eq(schema.helpers.weddingId, wedding.id)));
  await rewritePositions(wedding.id, (await loadHelpers(wedding.id)).map((h) => h.id));
  revalidateHelpers();
  if (text(formData, "redirectTo") === "list") redirect("/admin/day-of/helpers");
}

export async function reorderHelperAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;
  const ids = (await loadHelpers(wedding.id)).map((h) => h.id);
  await rewritePositions(wedding.id, moveId(ids, id, direction));
  revalidateHelpers();
}

async function rewritePositions(weddingId: string, ids: string[]) {
  await Promise.all(
    ids.map((id, position) =>
      db
        .update(schema.helpers)
        .set({ position })
        .where(and(eq(schema.helpers.id, id), eq(schema.helpers.weddingId, weddingId))),
    ),
  );
}

/** A new link for their page; the old one stops working (e.g. if it was shared by mistake). */
export async function newHelperLinkAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db
    .update(schema.helpers)
    .set({ token: newHelperToken() })
    .where(and(eq(schema.helpers.id, id), eq(schema.helpers.weddingId, wedding.id)));
  revalidateHelpers();
}

// ---------------------------------------------------------------- email

async function emailHelper(wedding: Wedding, helper: Helper, jobCount: number, replyTo: string | undefined, kind: "single" | "bulk" = "single") {
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const jobs = jobCount === 1 ? "one job" : `${jobCount} jobs`;
  const rendered = renderEmail({
    heading: couple,
    body: `Hi ${firstName(helper.name)},\n\nThank you for helping on the day! You've got ${jobs} on the run sheet. Your page has what each one is, when and where, and who else is on it.\n\nKeep this link handy on your phone. If plans change, your page changes too, so it's always up to date.`,
    button: { label: "See your jobs", url: helperUrl(helper.token) },
    footer: wedding.date ? `${couple} · ${formatDateLong(wedding.date)}` : couple,
    accentColor: wedding.accentColor,
  });
  return sendEmail({
    to: helper.email!,
    subject: `Your jobs for ${couple}'s wedding`,
    html: rendered.html,
    text: rendered.text,
    replyTo,
    weddingId: wedding.id,
  }, { kind });
}

function jobCounts(assignments: { helperId: string }[]) {
  const counts = new Map<string, number>();
  for (const a of assignments) counts.set(a.helperId, (counts.get(a.helperId) ?? 0) + 1);
  return counts;
}

export async function emailHelperAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding, user } = await requireHost();
  const id = text(formData, "id");
  const [helper] = id
    ? await db
        .select()
        .from(schema.helpers)
        .where(and(eq(schema.helpers.id, id), eq(schema.helpers.weddingId, wedding.id)))
        .limit(1)
    : [];
  if (!helper) return fail("That helper has been removed.");
  if (!helper.email) return fail(`Add an email address for ${helper.name} first.`);
  const count = jobCounts(await loadAssignments(wedding.id)).get(helper.id) ?? 0;
  if (count === 0) return fail(`${helper.name} isn't on any jobs yet. Add them to a job on the run sheet first.`);

  const res = await emailHelper(wedding, helper, count, user.email);
  return res.ok ? ok(`Emailed ${helper.email}.`) : fail(`Couldn't email ${helper.name}: ${res.error}`);
}

/** Emails every helper who has an email address and at least one job. Stops at the first failure. */
export async function emailAllHelpersAction(): Promise<ActionState> {
  const { wedding, user } = await requireHost();
  const [helpers, assignments] = await Promise.all([loadHelpers(wedding.id), loadAssignments(wedding.id)]);
  const counts = jobCounts(assignments);
  const targets = helpers.filter((h) => h.email && (counts.get(h.id) ?? 0) > 0);
  if (!targets.length) return fail("No helpers with an email address are on a job yet.");

  let sent = 0;
  for (const helper of targets) {
    const res = await emailHelper(wedding, helper, counts.get(helper.id)!, user.email, "bulk");
    if (!res.ok) {
      const done = sent ? `Emailed ${sent} of ${targets.length} helpers, then stopped. ` : "";
      return fail(`${done}Couldn't email ${helper.name}: ${res.error}`);
    }
    sent++;
  }
  return ok(sent === 1 ? "Emailed 1 helper." : `Emailed all ${sent} helpers.`);
}
