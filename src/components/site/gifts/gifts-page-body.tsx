import { TextBlock } from "@/components/ui";
import type { schema } from "@/db";
import { loadGuestGiftBundle, loadHouseholdLabelForViewer } from "@/lib/gift-admin/data";
import { sortGuestItems } from "@/lib/gift-admin/helpers";
import { fundProgress } from "@/lib/gifts";
import type { Viewer } from "@/lib/site-access";
import { CashFundCard } from "./cash-fund-card";
import { GiftItemCard } from "./gift-item-card";

type WeddingRow = typeof schema.weddings.$inferSelect;
type PageRow = typeof schema.pages.$inferSelect;

export async function GiftsPageBody({
  wedding,
  page,
  viewer,
}: {
  wedding: WeddingRow;
  page: PageRow;
  viewer: Viewer;
}) {
  const [{ items, claims, funds, contributions }, defaultGiverName] = await Promise.all([
    loadGuestGiftBundle(wedding.id),
    loadHouseholdLabelForViewer(wedding.id, viewer.householdId),
  ]);

  const sortedItems = sortGuestItems(items, claims);
  const hasIntro = Boolean(page.body?.trim());
  const hasItems = sortedItems.length > 0;
  const hasFunds = funds.length > 0;

  // Nothing to show (no visible items or funds) → render only the intro text (if any) and nothing else.
  if (!hasItems && !hasFunds) {
    if (!hasIntro) return null;
    return (
      <div className="mx-auto max-w-2xl text-base leading-relaxed text-ink-muted">
        <TextBlock text={page.body} />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {hasIntro && (
        <div className="mx-auto max-w-2xl text-base leading-relaxed text-ink-muted">
          <TextBlock text={page.body} />
        </div>
      )}

      {hasFunds && (
        <section className="space-y-6" aria-labelledby="cash-funds-heading">
          {hasItems && (
            <h2
              id="cash-funds-heading"
              className="font-serif text-3xl font-medium text-ink"
            >
              Cash funds
            </h2>
          )}
          <div className="grid gap-6">
            {funds.map((fund) => {
              const progress = fundProgress(fund, contributions);
              return (
                <CashFundCard
                  key={fund.id}
                  slug={wedding.slug}
                  currency={wedding.currency}
                  defaultGiverName={defaultGiverName}
                  fund={{
                    id: fund.id,
                    name: fund.name,
                    description: fund.description,
                    goalCents: fund.goalCents,
                    pledgedCents: progress.pledgedCents,
                    paymentInstructions: fund.paymentInstructions,
                    paymentUrl: fund.paymentUrl,
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      {hasItems && (
        <section className="space-y-6" aria-labelledby="gift-items-heading">
          {hasFunds && (
            <h2
              id="gift-items-heading"
              className="font-serif text-3xl font-medium text-ink"
            >
              Gift ideas
            </h2>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {sortedItems.map(({ item, progress }) => (
              <GiftItemCard
                key={item.id}
                slug={wedding.slug}
                currency={wedding.currency}
                defaultGiverName={defaultGiverName}
                item={{
                  id: item.id,
                  name: item.name,
                  url: item.url,
                  storeName: item.storeName,
                  priceCents: item.priceCents,
                  quantityWanted: item.quantityWanted,
                  mostWanted: item.mostWanted,
                  note: item.note,
                  imageUrl: item.imageUrl,
                  remaining: progress.remaining,
                  complete: progress.complete,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
