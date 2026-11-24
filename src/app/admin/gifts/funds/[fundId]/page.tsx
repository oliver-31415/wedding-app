import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { CashFundForm } from "@/components/admin/gifts/cash-fund-form";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";

export default async function EditCashFundPage({ params }: PageProps<"/admin/gifts/funds/[fundId]">) {
  const { wedding } = await requireHost();
  const { fundId } = await params;

  const [fund] = await db
    .select()
    .from(schema.cashFunds)
    .where(and(eq(schema.cashFunds.id, fundId), eq(schema.cashFunds.weddingId, wedding.id)))
    .limit(1);

  if (!fund) notFound();

  return (
    <div>
      <PageHeader
        title={`Edit “${fund.name}”`}
        back={
          <BackLink href="/admin/gifts/funds">Cash funds</BackLink>
        }
      />
      <Card>
        <CardBody>
          <CashFundForm fund={fund} currency={wedding.currency} />
        </CardBody>
      </Card>
    </div>
  );
}
