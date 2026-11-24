import { describe, expect, it } from "vitest";
import { computeGiftSummary, fundProgress, itemProgress } from "./gifts";

const items = [
  { id: "a", quantityWanted: 2, hidden: false },
  { id: "b", quantityWanted: 1, hidden: false },
  { id: "c", quantityWanted: 1, hidden: true },
];
const claims = [
  { itemId: "a", quantity: 1, thankedAt: null },
  { itemId: "b", quantity: 1, thankedAt: new Date() },
];
const funds = [{ id: "f", goalCents: 10000, hidden: false }];
const contributions = [
  { fundId: "f", amountCents: 5000, received: true, thankedAt: null },
  { fundId: "f", amountCents: 2500, received: false, thankedAt: null },
];

describe("gifts", () => {
  it("tracks item progress", () => {
    expect(itemProgress(items[0], claims)).toEqual({ claimed: 1, remaining: 1, complete: false });
    expect(itemProgress(items[1], claims)).toEqual({ claimed: 1, remaining: 0, complete: true });
  });
  it("tracks fund progress", () => {
    expect(fundProgress(funds[0], contributions)).toEqual({ pledgedCents: 7500, receivedCents: 5000, count: 2, goalCents: 10000 });
  });
  it("summarises, ignoring hidden items", () => {
    expect(computeGiftSummary({ items, claims, funds, contributions })).toEqual({
      items: { listed: 2, fullyGifted: 1, partlyGifted: 1 },
      gifts: 4,
      pledgedCents: 7500,
      receivedCents: 5000,
      toThank: 3,
    });
  });
});
