"use server";

import { and, eq } from "drizzle-orm";
import { revalidateWedding } from "@/lib/revalidate";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { findInvitation } from "@/lib/rsvp/lookup";
import type { SubmissionInput } from "@/lib/rsvp/model";
import { saveRsvp } from "@/lib/rsvp/save";
import type { GuestFormState } from "@/lib/rsvp-guest/form-model";
import { loadHouseholdRsvpData } from "@/lib/rsvp-guest/load";
import { extractClientIp, lookupRateLimiter } from "@/lib/rsvp-guest/rate-limit";
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
  | { kind: "choose"; options: { householdId: string; label: string; choice: string }[] }
  | { kind: "none"; message: string }
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

  const snapshot = await loadSnapshot(wedding.id);
  const result = findInvitation(firstName, lastName, snapshot.guests);

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
    message:
      "We couldn't find an invitation under that name. Try the name exactly as it appears on your invitation, or contact the couple.",
  };
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
