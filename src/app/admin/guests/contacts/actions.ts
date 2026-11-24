"use server";

import { requireHost } from "@/lib/auth";
import { applySharedReply, dismissReplies, setCollector } from "@/lib/contact-collector";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { revalidateWedding } from "@/lib/revalidate";

export async function setCollectorAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  // "on" also makes a fresh link, which stops the old one working.
  await setCollector(wedding.id, text(formData, "to") === "on");
  revalidateWedding();
}

export async function applyContactReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const target = text(formData, "target");
  if (!id || !target) return fail("Choose who these details belong to.", { target: "Choose a household." });
  if (!(await applySharedReply(wedding.id, id, target))) return fail("That reply was already dealt with, or the household is gone.");
  revalidateWedding();
  return ok(target === "new" ? "Added to your guest list." : "Guest list updated.");
}

export async function dismissContactReplyAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (id) await dismissReplies(wedding.id, [id]);
  revalidateWedding();
}
