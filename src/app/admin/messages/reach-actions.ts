"use server";

import { requireHost } from "@/lib/auth";
import { text } from "@/lib/forms";
import { isManualMethod } from "@/lib/messaging/delivery-methods";
import { markReached, unmarkReached } from "@/lib/messaging/reach";
import { revalidateWedding } from "@/lib/revalidate";

/** "Sent another way": records that guests without email got a message (posted, texted…). */
export async function markReachedAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const messageId = text(formData, "messageId");
  const method = text(formData, "method");
  const guestIds = formData.getAll("guestId").filter((v): v is string => typeof v === "string" && v.length > 0);
  if (!messageId || !isManualMethod(method)) return;
  await markReached(wedding.id, messageId, guestIds, method);
  revalidateWedding();
}

export async function unmarkReachedAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "deliveryId");
  if (id) await unmarkReached(wedding.id, id);
  revalidateWedding();
}
