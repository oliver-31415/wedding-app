import type { ReactNode } from "react";
import { PageHeader, StatGrid, StatTile, SubNav } from "@/components/ui";
import type { GiftSummary } from "@/lib/gifts";
import { formatMoney } from "@/lib/money";

export const GIFTS_SUBNAV = [
  { href: "/admin/gifts", label: "Gifts" },
  { href: "/admin/gifts/funds", label: "Cash funds" },
  { href: "/admin/gifts/received", label: "Received" },
];

export function GiftsChrome({
  current,
  summary,
  currency,
  actions,
}: {
  current: "/admin/gifts" | "/admin/gifts/funds" | "/admin/gifts/received";
  summary: GiftSummary;
  currency: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Gift list"
        description="Manage gift ideas, cash funds, and track gifts received. Money goes straight to you — never through this site."
        actions={actions}
      />
      <SubNav items={GIFTS_SUBNAV} current={current} />
      <div className="mb-6">
        <StatGrid>
          <StatTile
            label="Items gifted"
            value={`${summary.items.fullyGifted} of ${summary.items.listed}`}
            detail={
              summary.items.partlyGifted > 0
                ? `${summary.items.partlyGifted} partly gifted`
                : undefined
            }
            href="/admin/gifts"
          />
          <StatTile
            label="Pledged"
            value={formatMoney(summary.pledgedCents, currency)}
            href="/admin/gifts/funds"
          />
          <StatTile
            label="Received"
            value={formatMoney(summary.receivedCents, currency)}
            href="/admin/gifts/received"
          />
          <StatTile
            label="To thank"
            value={summary.toThank}
            detail={summary.toThank === 0 && summary.gifts > 0 ? "All caught up" : undefined}
            href="/admin/gifts/received?filter=to_thank"
          />
        </StatGrid>
      </div>
    </>
  );
}
