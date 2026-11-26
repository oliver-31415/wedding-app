import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { GUESTS_SUBNAV } from "@/components/admin/guests/nav";
import { ContactReplies, type ReplyHousehold } from "@/components/admin/guests/contact-replies";
import { formatTimestamp } from "@/components/admin/messages/format";
import { Badge, Card, CardBody, CardHeader, ConfirmButton, CopyButton, PageHeader, SubmitButton, SubNav } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { addressOf } from "@/lib/contact-collector";
import { appUrl } from "@/lib/email-layout";
import { loadNameAliases } from "@/lib/name-checks";
import { findInvitation } from "@/lib/rsvp/lookup";
import { householdLabel } from "@/lib/rsvp/model";
import { setCollectorAction } from "./actions";

export const metadata: Metadata = { title: "Contact details" };

export default async function ContactDetailsPage() {
  const { wedding } = await requireHost();
  const [replies, resolved, households, guests, aliases] = await Promise.all([
    db
      .select()
      .from(schema.contactSubmissions)
      .where(and(eq(schema.contactSubmissions.weddingId, wedding.id), eq(schema.contactSubmissions.status, "pending")))
      .orderBy(asc(schema.contactSubmissions.createdAt)),
    db
      .select({
        id: schema.contactSubmissions.id,
        people: schema.contactSubmissions.people,
        via: schema.contactSubmissions.via,
        status: schema.contactSubmissions.status,
        householdId: schema.contactSubmissions.householdId,
        resolvedAt: schema.contactSubmissions.resolvedAt,
      })
      .from(schema.contactSubmissions)
      .where(and(eq(schema.contactSubmissions.weddingId, wedding.id), ne(schema.contactSubmissions.status, "pending")))
      .orderBy(desc(schema.contactSubmissions.resolvedAt))
      .limit(20),
    db.select().from(schema.households).where(eq(schema.households.weddingId, wedding.id)),
    db
      .select()
      .from(schema.guests)
      .where(eq(schema.guests.weddingId, wedding.id))
      .orderBy(asc(schema.guests.position), asc(schema.guests.createdAt)),
    loadNameAliases(wedding.id),
  ]);

  const snapGuests = guests.map((g) => ({ ...g, tagIds: [] as string[] }));
  const labelOf = new Map(
    households.map((h) => [h.id, householdLabel(h, snapGuests.filter((g) => g.householdId === h.id))]),
  );
  const replyHouseholds: ReplyHousehold[] = households
    .map((h) => ({
      id: h.id,
      label: labelOf.get(h.id)!,
      address: addressOf(h),
      members: guests
        .filter((g) => g.householdId === h.id)
        .map((g) => ({ id: g.id, firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en-AU"));

  // Suggest the household whose guest list has one of the people who replied.
  const suggest = (people: { firstName: string; lastName: string }[]) => {
    for (const p of people) {
      const found = findInvitation(p.firstName, p.lastName, snapGuests, aliases);
      if (found.kind === "match") return found.householdId;
      if (found.kind === "choose" && found.options.length === 1) return found.options[0].householdId;
    }
    return null;
  };

  const link = wedding.contactCollectorToken ? `${appUrl()}/contact/${wedding.contactCollectorToken}` : null;
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const suggestedText = link
    ? `Hi! We're getting our wedding guest list together. Could you pop your contact details in here? ${link}\n\n${couple}`
    : "";

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Ask guests for their email, phone and postal address, and keep your list up to date."
      />
      <SubNav items={GUESTS_SUBNAV} current="/admin/guests/contacts" />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Contact details form"
            description="A link you can text, message or post anywhere. People fill in their details, and you choose who they belong to before anything changes."
            actions={link ? <Badge tone="good">On</Badge> : <Badge>Off</Badge>}
          />
          <CardBody className="space-y-4">
            {link ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-sunken px-4 py-3">
                  <a href={link} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-brand hover:underline">
                    {link}
                  </a>
                  <CopyButton text={link} label="Copy link" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink">A message you could send with it</p>
                  <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm whitespace-pre-line text-ink-muted">
                    {suggestedText}
                  </p>
                  <CopyButton text={suggestedText} label="Copy message" />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  <form action={setCollectorAction}>
                    <input type="hidden" name="to" value="on" />
                    <ConfirmButton
                      variant="secondary"
                      confirm="Make a new link?"
                      detail="The current link will stop working, so anyone who hasn't used it yet will need the new one."
                    >
                      Make a new link
                    </ConfirmButton>
                  </form>
                  <form action={setCollectorAction}>
                    <input type="hidden" name="to" value="off" />
                    <ConfirmButton variant="secondary" confirm="Turn off the form?" detail="The link will stop working. You can turn it on again, with a new link.">
                      Turn off
                    </ConfirmButton>
                  </form>
                </div>
              </>
            ) : (
              <form action={setCollectorAction}>
                <input type="hidden" name="to" value="on" />
                <SubmitButton pendingLabel="Turning on…">Turn on and get a link</SubmitButton>
              </form>
            )}
            <p className="text-sm text-ink-muted">
              Each household also has its own personal link (on its page in the guest list). Details sent through a
              personal link update that household straight away.
            </p>
          </CardBody>
        </Card>

        <ContactReplies
          replies={replies.map((r) => ({
            id: r.id,
            people: r.people,
            address: r.address,
            note: r.note,
            received: formatTimestamp(r.createdAt, wedding.timeZone),
            suggestion: suggest(r.people),
          }))}
          households={replyHouseholds}
        />

        {resolved.length > 0 && (
          <Card>
            <CardHeader title="Recently dealt with" />
            <ul className="divide-y divide-line">
              {resolved.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="text-ink">
                    {r.people.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}
                    <span className="text-ink-muted">
                      {r.status === "applied" && r.householdId && labelOf.has(r.householdId)
                        ? ` → ${labelOf.get(r.householdId)}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-ink-muted">
                    {r.via === "personal" && <Badge tone="info">Personal link</Badge>}
                    {r.status === "applied" ? <Badge tone="good">Applied</Badge> : <Badge>Dismissed</Badge>}
                    {r.resolvedAt ? formatTimestamp(r.resolvedAt, wedding.timeZone) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
