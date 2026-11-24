import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import {
  describeRecipients,
  formatTimestamp,
} from "@/components/admin/messages/format";
import { NewMessageMenu } from "@/components/admin/messages/new-message-menu";
import {
  Badge,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  SubNav,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { MESSAGE_KIND_META } from "@/lib/messaging/templates";

export default async function MessagesPage({
  searchParams,
}: PageProps<"/admin/messages">) {
  const { wedding } = await requireHost();
  const sp = await searchParams;
  const tab = sp.tab === "sent" ? "sent" : "drafts";

  const [allMessages, deliveries, tagRows] = await Promise.all([
    db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.weddingId, wedding.id))
      .orderBy(desc(schema.messages.sentAt), desc(schema.messages.createdAt)),
    db
      .select({
        messageId: schema.messageDeliveries.messageId,
        status: schema.messageDeliveries.status,
      })
      .from(schema.messageDeliveries)
      .where(eq(schema.messageDeliveries.weddingId, wedding.id)),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const tagNames = new Map(tagRows.map((t) => [t.id, t.name]));

  const deliveryCounts = new Map<string, { sent: number; failed: number }>();
  for (const d of deliveries) {
    const entry = deliveryCounts.get(d.messageId) ?? { sent: 0, failed: 0 };
    if (d.status === "sent") entry.sent++;
    else entry.failed++;
    deliveryCounts.set(d.messageId, entry);
  }

  const drafts = allMessages.filter((m) => m.status === "draft");
  const sent = allMessages.filter((m) => m.status === "sent");
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Email guests with save-the-dates, invitations, RSVP reminders or updates."
        actions={<NewMessageMenu />}
      />

      {!emailEnabled() && (
        <Notice tone="warn">
          Email isn&apos;t set up yet, so messages are saved to the outbox instead of
          being sent.
          {isDev && (
            <>
              {" "}
              <Link href="/admin/dev/outbox" className="font-medium underline">
                Open dev outbox
              </Link>
            </>
          )}
        </Notice>
      )}

      <SubNav
        items={[
          { href: "/admin/messages", label: `Drafts (${drafts.length})` },
          { href: "/admin/messages?tab=sent", label: `Sent (${sent.length})` },
        ]}
        current={tab === "sent" ? "/admin/messages?tab=sent" : "/admin/messages"}
      />

      {tab === "drafts" ? (
        drafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            body="Start a save-the-date, invitation, RSVP reminder or custom email to send to your guests."
            action={<NewMessageMenu align="left" />}
          />
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Type</Th>
                  <Th>Recipients</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((m) => (
                  <tr key={m.id} className="hover:bg-sunken/50">
                    <Td>
                      <Link
                        href={`/admin/messages/${m.id}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {m.subject || (
                          <span className="italic text-ink-muted">
                            Untitled message
                          </span>
                        )}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{MESSAGE_KIND_META[m.kind].label}</Badge>
                    </Td>
                    <Td className="text-ink-muted">
                      {describeRecipients(m.recipients, tagNames)}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {formatTimestamp(m.createdAt, wedding.timeZone)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )
      ) : sent.length === 0 ? (
        <EmptyState
          title="No sent messages yet"
          body="Messages you send to guests will appear here along with their delivery status."
          action={<NewMessageMenu align="left" />}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Subject</Th>
                <Th>Type</Th>
                <Th>Sent</Th>
                <Th>Delivery</Th>
              </tr>
            </thead>
            <tbody>
              {sent.map((m) => {
                const counts = deliveryCounts.get(m.id) ?? { sent: 0, failed: 0 };
                return (
                  <tr key={m.id} className="hover:bg-sunken/50">
                    <Td>
                      <Link
                        href={`/admin/messages/${m.id}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {m.subject || "Untitled message"}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{MESSAGE_KIND_META[m.kind].label}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted">
                      {m.sentAt
                        ? formatTimestamp(m.sentAt, wedding.timeZone)
                        : "—"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-good">{counts.sent} sent</span>
                      <span className="mx-1.5 text-ink-faint">·</span>
                      <span
                        className={
                          counts.failed > 0 ? "font-medium text-bad" : "text-ink-muted"
                        }
                      >
                        {counts.failed} failed
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
