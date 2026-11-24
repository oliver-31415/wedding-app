import { asc, eq } from "drizzle-orm";
import { EventForm } from "@/components/admin/schedule/event-form";
import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";

export default async function NewEventPage() {
  const { wedding } = await requireHost();

  const tags = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id))
    .orderBy(asc(schema.tags.name));

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <BackLink href="/admin/schedule">Schedule</BackLink>
        }
        title="Add event"
        description="Add an event to your wedding schedule."
      />

      <Card>
        <CardBody>
          <EventForm tags={tags} timeZone={wedding.timeZone} />
        </CardBody>
      </Card>
    </div>
  );
}
