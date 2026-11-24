import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { GiftItemForm } from "@/components/admin/gifts/gift-item-form";
import { requireHost } from "@/lib/auth";

export default async function NewGiftItemPage() {
  const { wedding } = await requireHost();

  return (
    <div>
      <PageHeader
        title="Add gift"
        description="Add an item from any store. Paste a product link to fill in the details and picture."
        back={
          <BackLink href="/admin/gifts">Gifts</BackLink>
        }
      />
      <Card>
        <CardBody>
          <GiftItemForm currency={wedding.currency} />
        </CardBody>
      </Card>
    </div>
  );
}
