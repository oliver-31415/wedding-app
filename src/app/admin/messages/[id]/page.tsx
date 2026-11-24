import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { DraftEditor } from "@/components/admin/messages/draft-editor";
import { MarkReachedForm, UnmarkReachedButton } from "@/components/admin/messages/mark-reached";
import {
  buttonTargetLabel,
  describeRecipients,
  formatTimestamp,
} from "@/components/admin/messages/format";
import { BackLink, Badge, Card, CardBody, CardHeader, PageHeader, SubmitButton, Table, Td, TextBlock, Th } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { appUrl } from "@/lib/email-layout";
import { MESSAGE_KIND_META } from "@/lib/messaging/templates";
import { DELIVERY_METHOD_META } from "@/lib/messaging/delivery-methods";
import { notReached } from "@/lib/messaging/reach";
import { guestName, householdLabel } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import { duplicateMessage } from "./actions";

export default async function MessageDetailPage({
  params,
}: PageProps<"/admin/messages/[id]">) {
  const { user, wedding, siteBase } = await requireHost();
  const { id } = await params;

  const [message] = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.id, id), eq(schema.messages.weddingId, wedding.id)))
    .limit(1);

  if (!message) notFound();

  if (message.status === "draft") {
    const [snapshot, tagRows] = await Promise.all([
      loadSnapshot(wedding.id),
      db
        .select({ id: schema.tags.id, name: schema.tags.name })
        .from(schema.tags)
        .where(eq(schema.tags.weddingId, wedding.id))
        .orderBy(asc(schema.tags.name)),
    ]);

    return (
      <div>
        <PageHeader
          back={
            <BackLink href="/admin/messages">Messages</BackLink>
          }
          title={
            <span className="inline-flex flex-wrap items-center gap-2.5">
              <span>{MESSAGE_KIND_META[message.kind].label}</span>
              <Badge tone="warn">Draft</Badge>
            </span>
          }
          description="Edit your email, choose recipients and preview what guests will receive before sending."
        />

        <DraftEditor
          message={{
            id: message.id,
            kind: message.kind,
            subject: message.subject,
            body: message.body,
            buttonTarget: message.buttonTarget,
            buttonLabel: message.buttonLabel,
            recipients: message.recipients,
          }}
          wedding={{
            slug: wedding.slug,
            siteBase,
            partnerOne: wedding.partnerOne,
            partnerTwo: wedding.partnerTwo,
            date: wedding.date,
            accentColor: wedding.accentColor,
          }}
          snapshot={snapshot}
          tags={tagRows}
          hostEmail={user.email}
          hostName={user.name}
          baseUrl={appUrl()}
          emailConfigured={emailEnabled()}
          isDev={process.env.NODE_ENV !== "production"}
        />
      </div>
    );
  }

  // Sent message view
  const [deliveries, tagRows] = await Promise.all([
    db
      .select({
        id: schema.messageDeliveries.id,
        email: schema.messageDeliveries.email,
        method: schema.messageDeliveries.method,
        status: schema.messageDeliveries.status,
        error: schema.messageDeliveries.error,
        guestId: schema.messageDeliveries.guestId,
        firstName: schema.guests.firstName,
        lastName: schema.guests.lastName,
        householdId: schema.guests.householdId,
      })
      .from(schema.messageDeliveries)
      .leftJoin(schema.guests, eq(schema.guests.id, schema.messageDeliveries.guestId))
      .where(
        and(
          eq(schema.messageDeliveries.messageId, message.id),
          eq(schema.messageDeliveries.weddingId, wedding.id),
        ),
      )
      .orderBy(asc(schema.guests.firstName), asc(schema.messageDeliveries.email)),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id)),
  ]);

  const tagNames = new Map(tagRows.map((t) => [t.id, t.name]));
  const snapshot = await loadSnapshot(wedding.id);
  const emailedCount = deliveries.filter((d) => d.status === "sent" && d.method === "email").length;
  const otherCount = deliveries.filter((d) => d.status === "sent" && d.method !== "email").length;
  const failedCount = deliveries.filter((d) => d.status === "failed").length;
  const waiting = notReached(snapshot, message, deliveries);
  // Not reached yet, grouped into households (the usual unit for posting or texting).
  const waitingByHousehold = [...Map.groupBy(waiting, (w) => w.householdId)].map(([householdId, people]) => {
    const household = snapshot.households.find((h) => h.id === householdId);
    const members = snapshot.guests.filter((g) => g.householdId === householdId);
    return { householdId, label: household ? householdLabel(household, members) : "Household", people };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <BackLink href="/admin/messages?tab=sent">Messages</BackLink>
        }
        title={message.subject || "Untitled message"}
        description={`${MESSAGE_KIND_META[message.kind].label} · Sent ${
          message.sentAt ? formatTimestamp(message.sentAt, wedding.timeZone) : "—"
        }`}
        actions={
          <form action={duplicateMessage}>
            <input type="hidden" name="messageId" value={message.id} />
            <SubmitButton variant="secondary" pendingLabel="Duplicating…">
              Duplicate as new draft
            </SubmitButton>
          </form>
        }
      />

      <Card>
        <CardHeader
          title="Message"
          description={`Recipients: ${describeRecipients(message.recipients, tagNames)}${
            message.buttonTarget
              ? ` · Button: ${message.buttonLabel || buttonTargetLabel(message.buttonTarget)} (${buttonTargetLabel(message.buttonTarget)})`
              : ""
          }`}
        />
        <CardBody className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Subject
            </p>
            <p className="text-sm font-medium text-ink">{message.subject}</p>
          </div>
          <div className="space-y-1 border-t border-line pt-4">
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Body
            </p>
            <TextBlock text={message.body} className="text-sm text-ink" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Who it reached"
          description={[
            `${emailedCount} emailed`,
            otherCount ? `${otherCount} sent another way` : null,
            failedCount ? `${failedCount} failed` : null,
            waiting.length ? `${waiting.length} not reached yet` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Table>
          <thead>
            <tr>
              <Th>Guest</Th>
              <Th>Email</Th>
              <Th>How</Th>
              <Th>Error</Th>
              <Th>
                <span className="sr-only">Undo</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <Td>
                  {d.firstName && d.lastName && d.householdId ? (
                    <Link
                      href={`/admin/guests/${d.householdId}`}
                      className="font-medium text-ink hover:text-brand hover:underline"
                    >
                      {guestName({ firstName: d.firstName, lastName: d.lastName })}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">Deleted guest</span>
                  )}
                </Td>
                <Td className="text-ink-muted">{d.email ?? "—"}</Td>
                <Td>
                  {d.status === "sent" ? (
                    <Badge tone={DELIVERY_METHOD_META[d.method].tone}>{DELIVERY_METHOD_META[d.method].label}</Badge>
                  ) : (
                    <Badge tone="bad">Failed</Badge>
                  )}
                </Td>
                <Td className={d.error ? "text-bad" : "text-ink-faint"}>
                  {d.error ?? "—"}
                </Td>
                <Td>{d.method !== "email" && <UnmarkReachedButton deliveryId={d.id} />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {waiting.length > 0 && (
        <Card>
          <CardHeader
            title="Not reached yet"
            description="These guests match this message but weren't emailed: they have no email address, or were added after it went out. If you've posted, texted or told them, mark it here so they count as reached."
            actions={
              waiting.length > 1 ? (
                <MarkReachedForm
                  messageId={message.id}
                  guestIds={waiting.map((w) => w.guestId)}
                  label={`Mark all ${waiting.length}`}
                  idSuffix="all"
                />
              ) : undefined
            }
          />
          <ul className="divide-y divide-line">
            {waitingByHousehold.map((h) => (
              <li key={h.householdId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0 text-sm">
                  <Link href={`/admin/guests/${h.householdId}`} className="font-medium text-ink hover:text-brand hover:underline">
                    {h.label}
                  </Link>
                  <p className="text-ink-muted">
                    {h.people
                      .map((p) => `${p.name}${p.reason === "added_since" ? " (added since)" : " (no email)"}`)
                      .join(", ")}
                  </p>
                </div>
                <MarkReachedForm messageId={message.id} guestIds={h.people.map((p) => p.guestId)} idSuffix={h.householdId} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
