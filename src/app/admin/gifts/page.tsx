import { GiftPicture } from "@/components/site/gifts/gift-picture";
import {
  Badge,
  Card,
  CardBody,
  ConfirmButton,
  EmptyState,
  LinkButton,
  ReorderButtons,
  TextBlock,
} from "@/components/ui";
import { GiftsChrome } from "@/components/admin/gifts/gifts-chrome";
import { requireHost } from "@/lib/auth";
import { loadAdminGiftBundle } from "@/lib/gift-admin/data";
import { itemStatusBadge } from "@/lib/gift-admin/helpers";
import { itemProgress } from "@/lib/gifts";
import { formatMoney } from "@/lib/money";
import { deleteGiftItemAction, reorderGiftItemsAction } from "./actions";

export default async function AdminGiftsPage() {
  const { wedding } = await requireHost();
  const { items, claims, summary } = await loadAdminGiftBundle(wedding.id);

  return (
    <div>
      <GiftsChrome
        current="/admin/gifts"
        summary={summary}
        currency={wedding.currency}
        actions={
          <LinkButton variant="primary" href="/admin/gifts/new">
            Add gift
          </LinkButton>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No gifts on your list yet"
          body="Your gift list starts empty and guests only see what you add here. Add items from any store, or head to Cash funds if you'd prefer a wishing well."
          action={
            <LinkButton variant="primary" href="/admin/gifts/new">
              Add gift
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const itemClaims = claims.filter((c) => c.itemId === item.id);
            const progress = itemProgress(item, claims);
            const statusBadge = itemStatusBadge(progress, item.quantityWanted);
            const confirmMsg =
              itemClaims.length > 0
                ? `Delete “${item.name}”? ${
                    itemClaims.length === 1
                      ? "1 recorded gift claim"
                      : `${itemClaims.length} recorded gift claims`
                  } will also be deleted. Consider hiding this item instead if you want to keep your records.`
                : `Delete “${item.name}” from your gift list?`;

            return (
              <Card key={item.id}>
                <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 pt-0.5">
                      <ReorderButtons
                        id={item.id}
                        action={reorderGiftItemsAction}
                        isFirst={idx === 0}
                        isLast={idx === items.length - 1}
                        label={item.name}
                      />
                    </div>
                    <GiftPicture src={item.imageUrl} alt="" size="thumb" />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-ink">{item.name}</h2>
                        {item.mostWanted && <Badge tone="brand">Most wanted</Badge>}
                        {statusBadge && <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>}
                        {item.hidden && <Badge tone="neutral">Hidden</Badge>}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                        {item.storeName && <span>{item.storeName}</span>}
                        {item.priceCents != null && (
                          <span className="font-medium text-ink tabular-nums">
                            {formatMoney(item.priceCents, wedding.currency)}
                          </span>
                        )}
                        {item.quantityWanted > 1 && <span>Wanted: {item.quantityWanted}</span>}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline"
                          >
                            View in store ↗
                          </a>
                        )}
                      </div>

                      {item.note && (
                        <TextBlock text={item.note} className="pt-1 text-sm text-ink-muted" />
                      )}

                      {itemClaims.length > 0 && (
                        <div className="pt-1.5 text-sm">
                          <span className="text-ink-muted">Claimed by: </span>
                          <span className="text-ink">
                            {itemClaims
                              .map((c) => (c.quantity > 1 ? `${c.giverName} × ${c.quantity}` : c.giverName))
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <LinkButton size="sm" variant="secondary" href={`/admin/gifts/${item.id}`}>
                      Edit
                    </LinkButton>
                    <form action={deleteGiftItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmButton confirm={confirmMsg}>Delete</ConfirmButton>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
