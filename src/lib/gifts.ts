/**
 * Gift list numbers, shared by the gift admin, the dashboard and the guest
 * gift page. Pure functions take plain rows; `loadGiftData` (gifts-data.ts) fetches them.
 */
import type { schema } from "@/db";

type Item = Pick<typeof schema.giftItems.$inferSelect, "id" | "quantityWanted" | "hidden">;
type Claim = Pick<typeof schema.giftClaims.$inferSelect, "itemId" | "quantity" | "thankedAt">;
type Fund = Pick<typeof schema.cashFunds.$inferSelect, "id" | "goalCents" | "hidden">;
type Contribution = Pick<typeof schema.fundContributions.$inferSelect, "fundId" | "amountCents" | "received" | "thankedAt">;

export type GiftData = { items: Item[]; claims: Claim[]; funds: Fund[]; contributions: Contribution[] };

/** How many of an item have been claimed, and how many are still wanted. */
export function itemProgress(item: Item, claims: Claim[]) {
  const claimed = claims.filter((c) => c.itemId === item.id).reduce((s, c) => s + c.quantity, 0);
  return { claimed, remaining: Math.max(0, item.quantityWanted - claimed), complete: claimed >= item.quantityWanted };
}

/** Pledged includes received. */
export function fundProgress(fund: Fund, contributions: Contribution[]) {
  const mine = contributions.filter((c) => c.fundId === fund.id);
  const pledgedCents = mine.reduce((s, c) => s + c.amountCents, 0);
  const receivedCents = mine.filter((c) => c.received).reduce((s, c) => s + c.amountCents, 0);
  return { pledgedCents, receivedCents, count: mine.length, goalCents: fund.goalCents };
}

export type GiftSummary = {
  items: { listed: number; fullyGifted: number; partlyGifted: number };
  gifts: number;
  pledgedCents: number;
  receivedCents: number;
  /** Gifts and contributions not yet marked as thanked. */
  toThank: number;
};

export function computeGiftSummary(d: GiftData): GiftSummary {
  const listed = d.items.filter((i) => !i.hidden);
  let fullyGifted = 0;
  let partlyGifted = 0;
  for (const item of listed) {
    const p = itemProgress(item, d.claims);
    if (p.complete) fullyGifted++;
    else if (p.claimed > 0) partlyGifted++;
  }
  return {
    items: { listed: listed.length, fullyGifted, partlyGifted },
    gifts: d.claims.length + d.contributions.length,
    pledgedCents: d.contributions.reduce((s, c) => s + c.amountCents, 0),
    receivedCents: d.contributions.filter((c) => c.received).reduce((s, c) => s + c.amountCents, 0),
    toThank: d.claims.filter((c) => !c.thankedAt).length + d.contributions.filter((c) => !c.thankedAt).length,
  };
}
