import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { OutboxViewer } from "@/components/admin/messages/outbox-viewer";
import { BackLink, PageHeader } from "@/components/ui";
import { requireHost } from "@/lib/auth";

export default async function DevOutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { wedding } = await requireHost();

  const rows = await db
    .select()
    .from(schema.outbox)
    .where(eq(schema.outbox.weddingId, wedding.id))
    .orderBy(desc(schema.outbox.createdAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        back={
          <BackLink href="/admin/messages">Messages</BackLink>
        }
        title="Dev outbox"
        description="Every email sent by the app in development — messages, RSVP confirmations and invites — lands here (newest 100)."
      />

      <OutboxViewer
        emails={rows.map((r) => ({
          id: r.id,
          to: r.to,
          subject: r.subject,
          html: r.html,
          text: r.text,
          createdAtMs: r.createdAt.getTime(),
        }))}
        timeZone={wedding.timeZone}
      />
    </div>
  );
}
