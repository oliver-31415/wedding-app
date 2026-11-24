import { asc, eq } from "drizzle-orm";
import { ImportWizard } from "@/components/admin/guests/import-wizard";
import { GUESTS_SUBNAV } from "@/components/admin/guests/nav";
import { PageHeader, SubNav, buttonClass } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { householdLabel } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";

export default async function ImportGuestsPage() {
  const { wedding } = await requireHost();

  const [snapshot, allTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const guestsByHousehold = new Map<string, typeof snapshot.guests>();
  for (const g of snapshot.guests) {
    const list = guestsByHousehold.get(g.householdId);
    if (list) list.push(g);
    else guestsByHousehold.set(g.householdId, [g]);
  }
  const labelByHousehold = new Map<string, string>();
  for (const h of snapshot.households) {
    labelByHousehold.set(h.id, householdLabel(h, guestsByHousehold.get(h.id) ?? []));
  }

  const existingGuests = snapshot.guests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    householdLabel: labelByHousehold.get(g.householdId) ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="Import guests"
        description="Upload a CSV spreadsheet to add households in bulk."
        actions={
          <a
            href="/admin/guests/import/template.csv"
            download="guest-list-template.csv"
            className={buttonClass("secondary")}
          >
            Download template CSV
          </a>
        }
      />
      <SubNav items={GUESTS_SUBNAV} current="/admin/guests/import" />
      <ImportWizard existingGuests={existingGuests} existingTags={allTags} />
    </div>
  );
}
