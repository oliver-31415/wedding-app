import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeGiftSummary } from "@/lib/gifts";
import { householdLabel, type SnapGuest } from "@/lib/rsvp/model";
import { canViewPage, getViewer, type Viewer } from "@/lib/site-access";

export type GiftItemRow = typeof schema.giftItems.$inferSelect;
export type GiftClaimRow = typeof schema.giftClaims.$inferSelect;
export type CashFundRow = typeof schema.cashFunds.$inferSelect;
export type FundContributionRow = typeof schema.fundContributions.$inferSelect;

/** Loads all gift list tables for one wedding (host admin), plus summary via computeGiftSummary. */
export async function loadAdminGiftBundle(weddingId: string) {
  const [items, claims, funds, contributions] = await Promise.all([
    db
      .select()
      .from(schema.giftItems)
      .where(eq(schema.giftItems.weddingId, weddingId))
      .orderBy(asc(schema.giftItems.position), asc(schema.giftItems.createdAt)),
    db
      .select()
      .from(schema.giftClaims)
      .where(eq(schema.giftClaims.weddingId, weddingId))
      .orderBy(desc(schema.giftClaims.createdAt)),
    db
      .select()
      .from(schema.cashFunds)
      .where(eq(schema.cashFunds.weddingId, weddingId))
      .orderBy(asc(schema.cashFunds.position), asc(schema.cashFunds.createdAt)),
    db
      .select()
      .from(schema.fundContributions)
      .where(eq(schema.fundContributions.weddingId, weddingId))
      .orderBy(desc(schema.fundContributions.createdAt)),
  ]);

  const summary = computeGiftSummary({ items, claims, funds, contributions });
  return { items, claims, funds, contributions, summary };
}

/** Loads visible gift items and cash funds for the guest site, plus claims/contributions for progress. */
export async function loadGuestGiftBundle(weddingId: string) {
  const [items, claims, funds, contributions] = await Promise.all([
    db
      .select()
      .from(schema.giftItems)
      .where(and(eq(schema.giftItems.weddingId, weddingId), eq(schema.giftItems.hidden, false)))
      .orderBy(asc(schema.giftItems.position), asc(schema.giftItems.createdAt)),
    db.select().from(schema.giftClaims).where(eq(schema.giftClaims.weddingId, weddingId)),
    db
      .select()
      .from(schema.cashFunds)
      .where(and(eq(schema.cashFunds.weddingId, weddingId), eq(schema.cashFunds.hidden, false)))
      .orderBy(asc(schema.cashFunds.position), asc(schema.cashFunds.createdAt)),
    db.select().from(schema.fundContributions).where(eq(schema.fundContributions.weddingId, weddingId)),
  ]);

  return { items, claims, funds, contributions };
}

/** Loads SnapGuests for a single household, with tag IDs for audience evaluation. */
async function loadHouseholdSnapGuests(weddingId: string, householdId: string): Promise<SnapGuest[]> {
  const [guestRows, tagRows] = await Promise.all([
    db
      .select()
      .from(schema.guests)
      .where(and(eq(schema.guests.weddingId, weddingId), eq(schema.guests.householdId, householdId)))
      .orderBy(asc(schema.guests.position), asc(schema.guests.createdAt)),
    db
      .select({ guestId: schema.guestTags.guestId, tagId: schema.guestTags.tagId })
      .from(schema.guestTags)
      .innerJoin(schema.guests, eq(schema.guests.id, schema.guestTags.guestId))
      .where(and(eq(schema.guests.weddingId, weddingId), eq(schema.guests.householdId, householdId))),
  ]);

  const tagsByGuest = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByGuest.get(row.guestId);
    if (list) list.push(row.tagId);
    else tagsByGuest.set(row.guestId, [row.tagId]);
  }

  return guestRows.map((g) => ({
    id: g.id,
    householdId: g.householdId,
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.email,
    ageGroup: g.ageGroup,
    isPlusOne: g.isPlusOne,
    tagIds: tagsByGuest.get(g.id) ?? [],
  }));
}

/** Returns the household's display label for pre-filling guest gift forms, or null if not identified. */
export async function loadHouseholdLabelForViewer(
  weddingId: string,
  householdId: string | null,
): Promise<string | null> {
  if (!householdId) return null;
  const [[household], snapGuests] = await Promise.all([
    db
      .select()
      .from(schema.households)
      .where(and(eq(schema.households.id, householdId), eq(schema.households.weddingId, weddingId)))
      .limit(1),
    loadHouseholdSnapGuests(weddingId, householdId),
  ]);
  if (!household) return null;
  return householdLabel(household, snapGuests);
}

/**
 * Verifies a guest (or previewing host) is allowed to act on the gifts page of
 * `slug`: loads the wedding by slug, checks `canViewPage(...)` for the gifts
 * page with the viewer, and ensures the site is published unless the viewer is
 * a host.
 */
export async function verifyGuestGiftsAccess(
  slug: string,
): Promise<
  | { ok: true; wedding: typeof schema.weddings.$inferSelect; page: typeof schema.pages.$inferSelect; viewer: Viewer }
  | { ok: false; error: string }
> {
  const [wedding] = await db
    .select()
    .from(schema.weddings)
    .where(eq(schema.weddings.slug, slug))
    .limit(1);
  if (!wedding) return { ok: false, error: "We couldn't find that wedding." };

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) {
    return { ok: false, error: "This wedding website isn't published yet." };
  }

  const [giftsPage] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.weddingId, wedding.id), eq(schema.pages.type, "gifts")))
    .limit(1);
  if (!giftsPage) return { ok: false, error: "This wedding doesn't have a gift list page." };

  const householdGuests = viewer.householdId
    ? await loadHouseholdSnapGuests(wedding.id, viewer.householdId)
    : [];

  const verdict = canViewPage(wedding, giftsPage, viewer, householdGuests);
  if (verdict !== "ok") {
    return { ok: false, error: "You don't have access to this gift list." };
  }

  return { ok: true, wedding, page: giftsPage, viewer };
}
