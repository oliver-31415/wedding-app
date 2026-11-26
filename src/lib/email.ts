import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db, schema } from "@/db";
import type { SendKind } from "@/lib/email-quota";
import { releaseSend, reserveSend } from "@/lib/email-usage";
import { newId } from "@/lib/ids";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** The wedding this email belongs to (scopes the dev outbox). */
  weddingId?: string | null;
};
export type SendResult =
  | { ok: true }
  /** `limited`: refused because an email limit is reached; nothing was sent, try again from `retryAt`. */
  | { ok: false; error: string; limited?: boolean; retryAt?: number | null };

/**
 * Email goes out over SMTP, so any provider works. For Resend:
 *   SMTP_HOST=smtp.resend.com  SMTP_PORT=465  SMTP_USER=resend  SMTP_PASS=<API key>
 *   EMAIL_FROM="Tom & Ana <wedding@wright-guys.com>"  (a domain verified in Resend)
 * SMTP_SECURE defaults to true on port 465 (TLS from the start) and false
 * otherwise (STARTTLS, e.g. port 587).
 */
export const emailEnabled = () => !!(process.env.SMTP_HOST && process.env.EMAIL_FROM);

const globalForMail = globalThis as unknown as { mailer?: Transporter };

function mailer(): Transporter {
  if (globalForMail.mailer) return globalForMail.mailer;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  globalForMail.mailer = transport;
  return transport;
}

/**
 * Sends one email. Without SMTP settings, development stores it in the
 * `outbox` table instead (view at /admin/dev/outbox); production refuses,
 * because emails contain personal links that must not pile up in the database.
 *
 * Every email counts against the account's daily and monthly limits
 * (src/lib/email-quota.ts) and is recorded in `email_sends`; once a limit is
 * reached it's refused with `limited: true`. Bulk messages pass
 * `kind: "bulk"` so they leave room for one-off emails.
 */
export async function sendEmail(email: Email, { kind = "single" }: { kind?: SendKind } = {}): Promise<SendResult> {
  if (!emailEnabled() && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Email isn't set up on this server." };
  }
  const slot = await reserveSend(email.weddingId, kind);
  if (!slot.ok) return { ok: false, error: slot.error, limited: true, retryAt: slot.retryAt };

  if (!emailEnabled()) {
    await db.insert(schema.outbox).values({
      id: newId(),
      weddingId: email.weddingId ?? null,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return { ok: true };
  }
  try {
    await mailer().sendMail({
      from: process.env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: email.replyTo,
    });
    return { ok: true };
  } catch (e) {
    await releaseSend(slot.id);
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
