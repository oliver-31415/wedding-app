"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/db";
import type { MessageRecipients } from "@/db/schema";
import { isButtonTarget, isRsvpStatus } from "@/components/admin/messages/format";
import { requireHost } from "@/lib/auth";
import { emailEnabled, sendEmail } from "@/lib/email";
import { fail, ok, readAudience, text, type ActionState } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { processEmailQueue, stopQueuedMessage } from "@/lib/messaging/queue";
import { selectRecipients } from "@/lib/messaging/recipients";
import { renderMessage } from "@/lib/messaging/render";
import { DEFAULT_BUTTON_LABELS, type ButtonTarget } from "@/lib/messaging/templates";
import { revalidateWedding } from "@/lib/revalidate";
import { loadSnapshot } from "@/lib/snapshot";

type ParsedDraft = {
  subject: string;
  body: string;
  buttonTarget: ButtonTarget | null;
  buttonLabel: string | null;
  recipients: MessageRecipients;
};

function parseDraftForm(
  formData: FormData,
): { ok: true; data: ParsedDraft } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  if (!subject) errors.subject = "Enter a subject.";
  if (!body) errors.body = "Write a message.";

  const rawTarget = text(formData, "buttonTarget");
  const buttonTarget = isButtonTarget(rawTarget) ? rawTarget : null;
  const rawLabel = text(formData, "buttonLabel");
  const buttonLabel = buttonTarget
    ? rawLabel ?? DEFAULT_BUTTON_LABELS[buttonTarget]
    : null;

  const audienceResult = readAudience(formData, "audience");
  if ("error" in audienceResult) {
    errors.audience = audienceResult.error;
  }

  const rawRsvpStatus = text(formData, "rsvpStatus");
  const rsvpStatus = isRsvpStatus(rawRsvpStatus) ? rawRsvpStatus : "any";

  if (Object.keys(errors).length > 0 || !subject || !body || "error" in audienceResult) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      subject,
      body,
      buttonTarget,
      buttonLabel,
      recipients: {
        audience: audienceResult,
        rsvpStatus,
      },
    },
  };
}

export async function saveDraft(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();
  const messageId = text(formData, "messageId");
  if (!messageId) return fail("Message not found.");

  const parsed = parseDraftForm(formData);
  if (!parsed.ok) return fail("Please fix the highlighted fields.", parsed.errors);

  const updated = await db
    .update(schema.messages)
    .set({
      subject: parsed.data.subject,
      body: parsed.data.body,
      buttonTarget: parsed.data.buttonTarget,
      buttonLabel: parsed.data.buttonLabel,
      recipients: parsed.data.recipients,
    })
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.weddingId, wedding.id),
        eq(schema.messages.status, "draft"),
      ),
    )
    .returning({ id: schema.messages.id });

  if (updated.length === 0) {
    return fail("This draft could not be saved — it may have already been sent.");
  }

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${messageId}`);
  return ok("Draft saved.");
}

export async function sendTestMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, wedding, siteBase } = await requireHost();
  const messageId = text(formData, "messageId");
  if (!messageId) return fail("Message not found.");

  const [existing] = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.weddingId, wedding.id),
        eq(schema.messages.status, "draft"),
      ),
    )
    .limit(1);
  if (!existing) return fail("Draft not found.");

  const errors: Record<string, string> = {};
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  if (!subject) errors.subject = "Enter a subject.";
  if (!body) errors.body = "Write a message.";
  if (Object.keys(errors).length > 0 || !subject || !body) {
    return fail("Enter a subject and message before sending a test.", errors);
  }

  const rawTarget = text(formData, "buttonTarget");
  const buttonTarget = isButtonTarget(rawTarget) ? rawTarget : null;
  const rawLabel = text(formData, "buttonLabel");
  const buttonLabel = buttonTarget
    ? rawLabel ?? DEFAULT_BUTTON_LABELS[buttonTarget]
    : null;

  const audienceResult = readAudience(formData, "audience");
  const rawRsvpStatus = text(formData, "rsvpStatus");
  const rsvpStatus = isRsvpStatus(rawRsvpStatus) ? rawRsvpStatus : "any";

  let firstName = user.name.trim().split(/\s+/)[0] || "Friend";
  let inviteToken: string | null = null;

  const snapshot = await loadSnapshot(wedding.id);
  const matching =
    "error" in audienceResult
      ? []
      : selectRecipients(snapshot, { audience: audienceResult, rsvpStatus }).recipients;
  const sampleRecipient = matching[0];

  if (sampleRecipient) {
    firstName = sampleRecipient.firstName;
    const [hh] = await db
      .select({ inviteToken: schema.households.inviteToken })
      .from(schema.households)
      .where(
        and(
          eq(schema.households.id, sampleRecipient.householdId),
          eq(schema.households.weddingId, wedding.id),
        ),
      )
      .limit(1);
    inviteToken = hh?.inviteToken ?? null;
  } else {
    const [hh] = await db
      .select({ inviteToken: schema.households.inviteToken })
      .from(schema.households)
      .where(eq(schema.households.weddingId, wedding.id))
      .limit(1);
    inviteToken = hh?.inviteToken ?? null;
  }

  const rendered = renderMessage({
    wedding: { ...wedding, siteBase },
    message: { subject, body, buttonTarget, buttonLabel },
    recipient: { firstName },
    inviteToken,
  });

  const res = await sendEmail({
    to: user.email,
    subject: `[Test] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    weddingId: wedding.id,
  });

  if (!res.ok) {
    return fail(`Could not send test email: ${res.error}`);
  }

  return ok(`Test email sent to ${user.email}.`);
}

export async function sendMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { wedding } = await requireHost();
  const messageId = text(formData, "messageId");
  if (!messageId) return fail("Message not found.");

  const parsed = parseDraftForm(formData);
  if (!parsed.ok) return fail("Please fix the highlighted fields.", parsed.errors);
  // Without email set up, production can't send anything: keep it a draft rather than fail every guest.
  if (!emailEnabled() && process.env.NODE_ENV === "production") {
    return fail("Email isn't set up on this server yet, so this message can't be sent. It's still saved as a draft.");
  }

  const snapshot = await loadSnapshot(wedding.id);
  const preview = selectRecipients(snapshot, parsed.data.recipients);
  if (preview.recipients.length === 0) {
    return fail("No guests match this filter with an email address.");
  }

  // Atomically claim the draft as "sent" and queue one email per recipient,
  // so a message can't be sent twice. The queue sends them as the email
  // limits allow (src/lib/messaging/queue.ts): most now, the rest later.
  const sentAt = new Date();
  const claimed = await db.transaction(
    async (tx) => {
      const rows = await tx
        .update(schema.messages)
        .set({
          subject: parsed.data.subject,
          body: parsed.data.body,
          buttonTarget: parsed.data.buttonTarget,
          buttonLabel: parsed.data.buttonLabel,
          recipients: parsed.data.recipients,
          status: "sent",
          sentAt,
        })
        .where(
          and(
            eq(schema.messages.id, messageId),
            eq(schema.messages.weddingId, wedding.id),
            eq(schema.messages.status, "draft"),
          ),
        )
        .returning({ id: schema.messages.id });
      if (rows.length === 0) return false;
      const queued = preview.recipients.map((r) => ({
        id: newId(),
        weddingId: wedding.id,
        messageId,
        guestId: r.guestId,
        email: r.email,
        method: "email" as const,
        status: "queued" as const,
        createdAt: sentAt,
      }));
      for (let i = 0; i < queued.length; i += 500) {
        await tx.insert(schema.messageDeliveries).values(queued.slice(i, i + 500));
      }
      return true;
    },
    { behavior: "immediate" },
  );

  if (!claimed) {
    return fail("This message has already been sent.");
  }

  // Start sending once the redirect is on its way; the message page shows progress.
  after(() => processEmailQueue());

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${messageId}`);
  redirect(`/admin/messages/${messageId}`);
}

/** "Stop sending the rest": drops this message's emails still waiting to send. */
export async function stopQueuedEmails(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const messageId = text(formData, "messageId");
  if (!messageId) return;
  await stopQueuedMessage(wedding.id, messageId);
  revalidateWedding();
}

export async function deleteDraft(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const messageId = text(formData, "messageId");
  if (!messageId) redirect("/admin/messages");

  await db
    .delete(schema.messages)
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.weddingId, wedding.id),
        eq(schema.messages.status, "draft"),
      ),
    );

  revalidatePath("/admin/messages");
  redirect("/admin/messages");
}

export async function duplicateMessage(formData: FormData): Promise<void> {
  const { user, wedding } = await requireHost();
  const messageId = text(formData, "messageId");
  if (!messageId) redirect("/admin/messages");

  const [source] = await db
    .select()
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.weddingId, wedding.id),
      ),
    )
    .limit(1);

  if (!source) redirect("/admin/messages");

  const id = newId();
  await db.insert(schema.messages).values({
    id,
    weddingId: wedding.id,
    kind: source.kind,
    subject: source.subject,
    body: source.body,
    buttonTarget: source.buttonTarget,
    buttonLabel: source.buttonLabel,
    recipients: source.recipients,
    status: "draft",
    sentAt: null,
    createdBy: user.id,
  });

  revalidatePath("/admin/messages");
  redirect(`/admin/messages/${id}`);
}
