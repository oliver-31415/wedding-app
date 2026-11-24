import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { GiftData } from "@/lib/gifts";

export async function loadGiftData(weddingId: string): Promise<GiftData> {
  const [items, claims, funds, contributions] = await Promise.all([
    db.select().from(schema.giftItems).where(eq(schema.giftItems.weddingId, weddingId)),
    db.select().from(schema.giftClaims).where(eq(schema.giftClaims.weddingId, weddingId)),
    db.select().from(schema.cashFunds).where(eq(schema.cashFunds.weddingId, weddingId)),
    db.select().from(schema.fundContributions).where(eq(schema.fundContributions.weddingId, weddingId)),
  ]);
  return { items, claims, funds, contributions };
}
