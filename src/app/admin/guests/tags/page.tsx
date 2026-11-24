import { asc, eq } from "drizzle-orm";
import { GUESTS_SUBNAV } from "@/components/admin/guests/nav";
import { TagsManager } from "@/components/admin/guests/tags-manager";
import { PageHeader, SubNav } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { tagUsage } from "@/lib/cleanup";

export default async function TagsPage() {
  const { wedding } = await requireHost();

  const [allTags, tagLinks] = await Promise.all([
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
    db
      .select({ tagId: schema.guestTags.tagId })
      .from(schema.guestTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.guestTags.tagId))
      .where(eq(schema.tags.weddingId, wedding.id)),
  ]);

  const counts = new Map<string, number>();
  for (const row of tagLinks) {
    counts.set(row.tagId, (counts.get(row.tagId) ?? 0) + 1);
  }

  const usages = await Promise.all(allTags.map((t) => tagUsage(wedding.id, t.id)));
  const tagsWithCounts = allTags.map((t, i) => {
    const u = usages[i];
    return {
      id: t.id,
      name: t.name,
      guestCount: counts.get(t.id) ?? 0,
      usedBy: [
        ...u.events.map((n) => `Event “${n}”`),
        ...u.pages.map((n) => `Page “${n}”`),
        ...u.questions.map((n) => `Question “${n}”`),
        ...u.drafts.map((n) => `Draft message “${n}”`),
      ],
    };
  });

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Group guests to control who is invited to events, who can see pages, and who gets RSVP questions."
      />
      <SubNav items={GUESTS_SUBNAV} current="/admin/guests/tags" />
      <TagsManager tags={tagsWithCounts} />
    </div>
  );
}
