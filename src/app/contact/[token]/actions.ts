"use server";

import { headers } from "next/headers";
import type { ContactPerson } from "@/db/schema";
import { applyPersonalReply, resolveContactLink, saveSharedReply } from "@/lib/contact-collector";
import { ADDRESS_FIELDS, MAX_CONTACT_PEOPLE, validateContactForm } from "@/lib/contacts";
import { revalidateWedding } from "@/lib/revalidate";
import { extractClientIp, guestActionLimiter } from "@/lib/rsvp-guest/rate-limit";

export type ContactFormState = { ok?: boolean; message?: string; errors?: Record<string, string> } | null;

const field = (fd: FormData, name: string) => {
  const v = fd.get(name);
  return typeof v === "string" ? v : undefined;
};

/** Replies from /contact/{token}. Shared-link replies wait for review; personal ones apply now. */
export async function submitContactDetailsAction(_prev: ContactFormState, fd: FormData): Promise<ContactFormState> {
  // Bots fill every field; people never see this one.
  if (field(fd, "website")) return { ok: true };
  const token = field(fd, "token") ?? "";
  const link = await resolveContactLink(token);
  if (!link) return { ok: false, message: "This link isn't working any more. Ask the couple for a new one." };

  const ip = extractClientIp(await headers());
  if (!guestActionLimiter.check(`contact:${link.wedding.id}:${ip}`).allowed) {
    return { ok: false, message: "Too many tries in a short time. Please wait a minute and try again." };
  }

  const address = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, field(fd, f)]));
  if (link.kind === "personal") {
    // People are fixed by the household; only their email and phone come from the form.
    const people = link.members.map((m) => ({
      firstName: m.firstName,
      lastName: m.lastName,
      email: field(fd, `guest.${m.id}.email`),
      phone: field(fd, `guest.${m.id}.phone`),
    }));
    const checked = validateContactForm({ people, address, note: field(fd, "note") });
    if (!checked.ok) return { ok: false, message: "Please check the highlighted fields.", errors: personalErrors(checked.errors, link.members) };
    await applyPersonalReply(link, checked);
    revalidateWedding();
    return { ok: true };
  }

  const people = Array.from({ length: MAX_CONTACT_PEOPLE }, (_, i) => ({
    firstName: field(fd, `people.${i}.firstName`),
    lastName: field(fd, `people.${i}.lastName`),
    email: field(fd, `people.${i}.email`),
    phone: field(fd, `people.${i}.phone`),
  }));
  const checked = validateContactForm({ people, address, note: field(fd, "note") });
  if (!checked.ok) return { ok: false, message: checked.errors.form ?? "Please check the highlighted fields.", errors: checked.errors };
  await saveSharedReply(link.wedding.id, checked);
  revalidateWedding();
  return { ok: true };
}

/** Maps "people.{i}.email" errors back to the personal form's per-guest field names. */
function personalErrors(errors: Record<string, string>, members: Pick<ContactPerson & { id: string }, "id">[]) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) {
    const m = /^people\.(\d+)\.(email|phone)$/.exec(k);
    out[m ? `guest.${members[Number(m[1])]?.id}.${m[2]}` : k] = v;
  }
  return out;
}
