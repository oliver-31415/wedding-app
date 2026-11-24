import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteEventAction } from "@/app/admin/schedule/actions";
import { EventForm } from "@/components/admin/schedule/event-form";
import { BackLink, Card, CardBody, ConfirmButton, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";

export default async function EditEventPage({
  params,
}: PageProps<"/admin/schedule/[eventId]">) {
  const { wedding } = await requireHost();
  const { eventId } = await params;

  const [eventRows, tags] = await Promise.all([
    db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.id, eventId), eq(schema.events.weddingId, wedding.id)))
      .limit(1),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const event = eventRows[0];
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <BackLink href="/admin/schedule">Schedule</BackLink>
        }
        title={event.name}
        actions={
          <form action={deleteEventAction}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="redirectTo" value="list" />
            <ConfirmButton
              confirm={`Delete "${event.name}"? Any RSVP answers guests gave for this event will be deleted too.`}
            >
              Delete event
            </ConfirmButton>
          </form>
        }
      />

      <Card>
        <CardBody>
          <EventForm event={event} tags={tags} timeZone={wedding.timeZone} />
        </CardBody>
      </Card>
    </div>
  );
}
