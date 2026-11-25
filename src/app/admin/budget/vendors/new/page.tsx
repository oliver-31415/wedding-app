import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { VendorForm } from "@/components/admin/budget/forms";
import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";

export const metadata: Metadata = { title: "Add vendor" };

export default async function NewVendorPage() {
  const { wedding } = await requireHost();
  const categories = await db
    .select({ id: schema.budgetCategories.id, name: schema.budgetCategories.name })
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.weddingId, wedding.id))
    .orderBy(asc(schema.budgetCategories.position));
  return (
    <div className="space-y-6">
      <PageHeader back={<BackLink href="/admin/budget/vendors">Vendors</BackLink>} title="Add vendor" description="You can add payments once the vendor is saved." />
      <Card>
        <CardBody>
          <VendorForm categories={categories} />
        </CardBody>
      </Card>
    </div>
  );
}
