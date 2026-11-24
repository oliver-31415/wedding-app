import { asc, eq } from "drizzle-orm";
import { HouseholdForm } from "@/components/admin/guests/household-form";
import { BackLink, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";

export default async function NewHouseholdPage() {
  const { wedding } = await requireHost();
  const allTags = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.weddingId, wedding.id))
    .orderBy(asc(schema.tags.name));

  return (
    <div>
      <PageHeader
        back={
          <BackLink href="/admin/guests">Guest list</BackLink>
        }
        title="Add household"
        description="Add one person or a family who will RSVP together."
      />
      <HouseholdForm mode="create" tags={allTags} />
    </div>
  );
}
