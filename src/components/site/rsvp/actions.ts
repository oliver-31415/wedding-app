"use server";

import { and, eq } from "drizzle-orm";
import { revalidateWedding } from "@/lib/revalidate";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { formatDateLong } from "@/lib/dates";
import {
  hostEmails,
  loadNameAliases,
  MAX_NAME_CHECK_EMAIL,
  MAX_NAME_CHECK_NOTE,
  MAX_PENDING_NAME_CHECKS,
  NAME_CHECKS_PATH,
} from "@/lib/name-checks";
import { findInvitation, nameKey } from "@/lib/rsvp/lookup";
import { MAX_NAME, type SubmissionInput } from "@/lib/rsvp/model";
import { newId } from "@/lib/ids";
import { saveRsvp } from "@/lib/rsvp/save";
import type { GuestFormState } from "@/lib/rsvp-guest/form-model";
import { loadHouseholdRsvpData } from "@/lib/rsvp-guest/load";
import { extractClientIp, lookupRateLimiter, nameCheckLimiter } from "@/lib/rsvp-guest/rate-limit";
import { resolveSafeNext } from "@/lib/rsvp-guest/safe-next";
import { sitePath } from "@/lib/site-paths";
import { siteBaseOf } from "@/lib/site-root";
import {
  collectRecipientEmails,
  formatConfirmationEmailBody,
  formatConfirmationEmailFooter,
  type ConfirmationSummary,
} from "@/lib/rsvp-guest/summary";
import {
  canViewPage,
  forgetHousehold,
  getViewer,
  identifyHousehold,
  signHouseholdChoice,
  verifyHouseholdChoice,
} from "@/lib/site-access";
import { loadSnapshot } from "@/lib/snapshot";

export type LookupActionState =
  | null
  | { kind: "matched" }
  | { kind: "choose"; options: { householdId: string; label: string; choice: string }[]; couple: string }
  | { kind: "none"; message: string; couple: string }
  | { kind: "too_many"; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "error"; message: string; errors?: { firstName?: string; lastName?: string } };

export async function lookupInvitationAction(
  _prev: LookupActionState,
  formData: FormData,
): Promise<LookupActionState> {
  const weddingId = String(formData.get("weddingId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim() || null;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();

  const fieldErrors: { firstName?: string; lastName?: string } = {};
  if (!firstName) fieldErrors.firstName = "Enter your first name.";
  if (!lastName) fieldErrors.lastName = "Enter your last name.";
  if (firstName.length > MAX_NAME) fieldErrors.firstName = "That's longer than a name.";
  if (lastName.length > MAX_NAME) fieldErrors.lastName = "That's longer than a name.";
  if (fieldErrors.firstName || fieldErrors.lastName) {
    return {
      kind: "error",
      message: "Enter your first and last name to find your invitation.",
      errors: fieldErrors,
    };
  }

  const [wedding] = await db.select().from(schema.weddings).where(eq(schema.weddings.id, weddingId));
  if (!wedding) {
    return { kind: "error", message: "We couldn't find this wedding." };
  }

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) {
    return { kind: "error", message: "This wedding website isn't published yet." };
  }

  const ip = extractClientIp(await headers());
  const limit = lookupRateLimiter.check(ip);
  if (!limit.allowed) {
    return {
      kind: "rate_limited",
      message: "Too many searches in a short time. Please wait a minute and try again.",
    };
  }

  const [snapshot, aliases] = await Promise.all([loadSnapshot(wedding.id), loadNameAliases(wedding.id)]);
  const result = findInvitation(firstName, lastName, snapshot.guests, aliases);
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;

  if (result.kind === "match") {
    await identifyHousehold(wedding.id, result.householdId);
    if (redirectTo) {
      const base = await siteBaseOf(wedding);
      redirect(resolveSafeNext(base, redirectTo, sitePath(base)));
    }
    revalidateWedding();
    return { kind: "matched" };
  }

  if (result.kind === "choose") {
    return {
      kind: "choose",
      options: result.options.map((o) => ({ ...o, choice: signHouseholdChoice(wedding.id, o.householdId) })),
      couple,
    };
  }

  if (result.kind === "too_many") {
    return {
      kind: "too_many",
      message:
        "Several invitations matched that name. Please enter your full first and last name as it appears on your invitation.",
    };
  }

  return {
    kind: "none",
    message: `We couldn't find that name. Check the spelling, or ask ${couple} to check it for you.`,
    couple,
  };
}

export type NameCheckActionState =
  | null
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string; errors?: { email?: string; note?: string; name?: string } };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A guest who can't find their invitation asks the couple to check their
 * name. Nothing about the guest list is revealed: the reply is the same
 * whether or not the name is close to someone's.
 */
export async function requestNameCheckAction(
  _prev: NameCheckActionState,
  formData: FormData,
): Promise<NameCheckActionState> {
  const weddingId = String(formData.get("weddingId") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!firstName || !lastName || firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return { kind: "error", message: "Enter your first and last name above first.", errors: { name: "Enter your name." } };
  }
  const errors: { email?: string; note?: string } = {};
  if (!email) errors.email = "Enter your email so they can send you your link.";
  else if (email.length > MAX_NAME_CHECK_EMAIL || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (note && note.length > MAX_NAME_CHECK_NOTE) errors.note = `Keep this under ${MAX_NAME_CHECK_NOTE} characters.`;
  if (errors.email || errors.note) return { kind: "error", message: "Please check the highlighted fields.", errors };

  const [wedding] = await db.select().from(schema.weddings).where(eq(schema.weddings.id, weddingId));
  if (!wedding) return { kind: "error", message: "We couldn't find this wedding." };
  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) {
    return { kind: "error", message: "This wedding website isn't published yet." };
  }
  if (!nameCheckLimiter.check(`${wedding.id}:${extractClientIp(await headers())}`).allowed) {
    return { kind: "error", message: "You've sent a few of these already. Please get in touch with the couple directly." };
  }

  const pending = await db
    .select({ firstName: schema.nameRequests.firstName, lastName: schema.nameRequests.lastName, email: schema.nameRequests.email })
    .from(schema.nameRequests)
    .where(and(eq(schema.nameRequests.weddingId, wedding.id), eq(schema.nameRequests.status, "pending")));

  // Asked already: don't add it twice (or email the couple again).
  const key = nameKey(firstName, lastName);
  if (pending.some((r) => r.email === email && nameKey(r.firstName, r.lastName) === key)) {
    return { kind: "sent", email };
  }
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  if (pending.length >= MAX_PENDING_NAME_CHECKS) {
    return {
      kind: "error",
      message: `${couple} have a lot of names to check right now. Please get in touch with them directly.`,
    };
  }

  const firstWaiting = pending.length === 0;
  await db.insert(schema.nameRequests).values({
    id: newId(),
    weddingId: wedding.id,
    firstName: firstName.slice(0, MAX_NAME),
    lastName: lastName.slice(0, MAX_NAME),
    email,
    note: note?.slice(0, MAX_NAME_CHECK_NOTE) ?? null,
  });

  // Email the couple only for the first one waiting, so they aren't spammed;
  // the dashboard and Name checks show the rest.
  try {
    if (firstWaiting) {
      const recipients = await hostEmails(wedding.id);
      const { html, text } = renderEmail({
        heading: couple,
        body: `${firstName} ${lastName} couldn't find their invitation on your website, so they've asked you to check their name.\n\nMatch them to someone on your guest list and we'll email them their invitation link. If they're not on your list, you can dismiss it.`,
        button: { label: "Check the name", url: `${appUrl()}${NAME_CHECKS_PATH}` },
        footer: wedding.date ? `${couple} · ${formatDateLong(wedding.date)}` : couple,
        accentColor: wedding.accentColor,
      });
      for (const to of recipients) {
        try {
          await sendEmail({ to, subject: `${firstName} ${lastName} asked you to check their name`, html, text, weddingId: wedding.id });
        } catch {
          // The request is saved; the couple will see it on the dashboard.
        }
      }
    }
  } catch {
    // Never fail the guest's request over the notification.
  }

  revalidateWedding();
  return { kind: "sent", email };
}

export async function selectHouseholdAction(args: {
  weddingId: string;
  householdId: string;
  /** Signed token from the lookup that offered this household. */
  choice: string;
  redirectTo?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const [wedding] = await db.select().from(schema.weddings).where(eq(schema.weddings.id, args.weddingId));
  if (!wedding) return { ok: false, message: "We couldn't find this wedding." };

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) {
    return { ok: false, message: "This wedding website isn't published yet." };
  }

  if (!lookupRateLimiter.check(extractClientIp(await headers())).allowed) {
    return { ok: false, message: "Too many attempts in a short time. Please wait a minute and try again." };
  }
  if (!verifyHouseholdChoice(wedding.id, args.householdId, args.choice)) {
    return { ok: false, message: "That search has expired. Please search for your name again." };
  }

  const [household] = await db
    .select({ id: schema.households.id })
    .from(schema.households)
    .where(and(eq(schema.households.id, args.householdId), eq(schema.households.weddingId, wedding.id)));

  if (!household) {
    return { ok: false, message: "We couldn't find that invitation." };
  }

  await identifyHousehold(wedding.id, household.id);
  if (args.redirectTo) {
    const base = await siteBaseOf(wedding);
    redirect(resolveSafeNext(base, args.redirectTo, sitePath(base)));
  }
  revalidateWedding();
  return { ok: true };
}

export async function forgetHouseholdAction(args: {
  weddingId: string;
  slug: string;
  redirectTo?: string | null;
}): Promise<void> {
  await forgetHousehold(args.weddingId);
  revalidateWedding();
  if (args.redirectTo) {
    const base = await siteBaseOf({ id: args.weddingId, slug: args.slug });
    redirect(resolveSafeNext(base, args.redirectTo, sitePath(base, "find")));
  }
}

export type SubmitRsvpActionResult =
  | {
      ok: true;
      firstResponse: boolean;
      summary: ConfirmationSummary;
      initialFormState: GuestFormState;
    }
  | {
      ok: false;
      errors: Record<string, string>;
      message: string;
    };

export async function submitRsvpAction(args: {
  weddingId: string;
  input: SubmissionInput;
}): Promise<SubmitRsvpActionResult> {
  const [wedding] = await db.select().from(schema.weddings).where(eq(schema.weddings.id, args.weddingId));
  if (!wedding) {
    return { ok: false, errors: {}, message: "Wedding not found." };
  }

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) {
    return { ok: false, errors: {}, message: "This wedding website isn't published yet." };
  }

  if (!viewer.householdId) {
    return {
      ok: false,
      errors: {},
      message: "We couldn't confirm your invitation. Please find your invitation again.",
    };
  }

  // The RSVP page must exist and be open to this household (the couple may
  // have hidden it or limited it to certain guests).
  const [rsvpPage] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.weddingId, wedding.id), eq(schema.pages.type, "rsvp")))
    .limit(1);
  const householdGuests = (await loadSnapshot(wedding.id)).guests.filter((g) => g.householdId === viewer.householdId);
  if (!rsvpPage || canViewPage(wedding, rsvpPage, viewer, householdGuests) !== "ok") {
    return { ok: false, errors: {}, message: "RSVPs aren't open on this website." };
  }

  const result = await saveRsvp({
    weddingId: wedding.id,
    householdId: viewer.householdId,
    input: args.input,
    source: "guest",
  });

  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors,
      message: result.message ?? "Please check the highlighted answers.",
    };
  }

  const fresh = await loadHouseholdRsvpData(wedding.id, viewer.householdId);
  if (!fresh) {
    return { ok: false, errors: {}, message: "We couldn't reload your RSVP summary." };
  }

  // Send confirmation email to every household member with an email address.
  // Email failures must never fail the saved RSVP.
  try {
    const recipients = collectRecipientEmails(fresh.guests);
    if (recipients.length > 0) {
      const [hhRow] = await db
        .select({ inviteToken: schema.households.inviteToken })
        .from(schema.households)
        .where(and(eq(schema.households.id, viewer.householdId), eq(schema.households.weddingId, wedding.id)));

      const heading = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
      const body = formatConfirmationEmailBody(fresh.summary, wedding);
      const button =
        wedding.rsvpAllowEdits && hhRow?.inviteToken
          ? {
              label: "View or change your RSVP",
              url: `${appUrl()}${sitePath(await siteBaseOf(wedding), `i/${hhRow.inviteToken}`)}`,
            }
          : null;
      const footer = formatConfirmationEmailFooter(wedding);
      const { html, text } = renderEmail({
        heading,
        body,
        button,
        footer,
        accentColor: wedding.accentColor,
      });
      const subject = result.firstResponse
        ? `RSVP confirmed — ${heading}`
        : `RSVP updated — ${heading}`;

      for (const to of recipients) {
        try {
          await sendEmail({ to, subject, html, text, weddingId: wedding.id });
        } catch {
          // Don't let an individual email failure fail the RSVP.
        }
      }
    }
  } catch {
    // Don't let confirmation email setup fail the RSVP.
  }

  revalidateWedding();
  return {
    ok: true,
    firstResponse: result.firstResponse,
    summary: fresh.summary,
    initialFormState: fresh.initialFormState,
  };
}
