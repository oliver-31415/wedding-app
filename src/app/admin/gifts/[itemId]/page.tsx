import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BackLink, Card, CardBody, Notice, PageHeader } from "@/components/ui";
import { GiftItemForm } from "@/components/admin/gifts/gift-item-form";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";

export default async function EditGiftItemPage({ params, searchParams }: PageProps<"/admin/gifts/[itemId]">) {
  const { wedding } = await requireHost();
  const { itemId } = await params;
  const { pictureNotice: rawNotice } = await searchParams;
  const pictureNotice = Array.isArray(rawNotice) ? rawNotice[0] : rawNotice;

  const [item] = await db
    .select()
    .from(schema.giftItems)
    .where(and(eq(schema.giftItems.id, itemId), eq(schema.giftItems.weddingId, wedding.id)))
    .limit(1);

  if (!item) notFound();

  return (
    <div>
      <PageHeader
        title={`Edit “${item.name}”`}
        back={<BackLink href="/admin/gifts">Gifts</BackLink>}
      />
      {pictureNotice === "shop_failed" && !item.imageUrl && (
        <div className="mb-4">
          <Notice tone="info" title="Gift added">
            We couldn’t get a picture from that shop (some shops block this) — you can upload one below.
          </Notice>
        </div>
      )}
      <Card>
        <CardBody>
          <GiftItemForm item={item} currency={wedding.currency} />
        </CardBody>
      </Card>
    </div>
  );
}
