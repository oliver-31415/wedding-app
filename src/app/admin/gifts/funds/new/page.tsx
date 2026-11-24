import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { CashFundForm } from "@/components/admin/gifts/cash-fund-form";
import { requireHost } from "@/lib/auth";

export default async function NewCashFundPage() {
  const { wedding } = await requireHost();

  return (
    <div>
      <PageHeader
        title="Add cash fund"
        description="Share your own PayID, bank details, or payment link so guests can contribute directly to you."
        back={
          <BackLink href="/admin/gifts/funds">Cash funds</BackLink>
        }
      />
      <Card>
        <CardBody>
          <CashFundForm currency={wedding.currency} />
        </CardBody>
      </Card>
    </div>
  );
}
