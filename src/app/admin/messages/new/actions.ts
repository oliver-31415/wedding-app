"use server";

import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { buildMessageTemplate, isMessageKind } from "@/lib/messaging/templates";

/** Starts a draft from a template. A POST, so prefetching or reloading a page never creates drafts. */
export async function createDraftAction(formData: FormData): Promise<void> {
  const { user, wedding } = await requireHost();
  const kind = formData.get("kind");
  if (typeof kind !== "string" || !isMessageKind(kind)) redirect("/admin/messages/new");
  const template = buildMessageTemplate(kind, wedding);
  const id = newId();
  await db.insert(schema.messages).values({
    id,
    weddingId: wedding.id,
    kind: template.kind,
    subject: template.subject,
    body: template.body,
    buttonTarget: template.buttonTarget,
    buttonLabel: template.buttonLabel,
    recipients: template.recipients,
    status: "draft",
    createdBy: user.id,
  });
  redirect(`/admin/messages/${id}`);
}
