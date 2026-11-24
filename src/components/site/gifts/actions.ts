"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { extractClientIp, guestActionLimiter } from "@/lib/rsvp-guest/rate-limit";
import { db, schema } from "@/db";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import { verifyGuestGiftsAccess } from "@/lib/gift-admin/data";
import { validateGuestClaimInput, validateGuestPledgeInput } from "@/lib/gift-admin/helpers";
import { itemProgress } from "@/lib/gifts";
import { newId } from "@/lib/ids";
import { revalidateWedding } from "@/lib/revalidate";

export async function claimGiftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const itemId = text(formData, "itemId");
  if (!slug || !itemId) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }

  const access = await verifyGuestGiftsAccess(slug);
  if (!access.ok) {
    return fail(access.error);
  }
  const { wedding } = access;
  if (!guestActionLimiter.check(`gift:${wedding.id}:${extractClientIp(await headers())}`).allowed) {
    return fail("Too many in a short time — please wait a minute and try again.");
  }

  const raw = {
    giverName: text(formData, "giverName"),
    giverEmail: text(formData, "giverEmail"),
    quantity: text(formData, "quantity"),
    message: text(formData, "message"),
  };

  const txResult = await db.transaction(async (tx): Promise<ActionState> => {
    const [item] = await tx
      .select()
      .from(schema.giftItems)
      .where(
        and(
          eq(schema.giftItems.id, itemId),
          eq(schema.giftItems.weddingId, wedding.id),
          eq(schema.giftItems.hidden, false),
        ),
      )
      .limit(1);

    if (!item) {
      return fail("This gift item is no longer on the list.");
    }

    const existingClaims = await tx
      .select({
        itemId: schema.giftClaims.itemId,
        quantity: schema.giftClaims.quantity,
        thankedAt: schema.giftClaims.thankedAt,
      })
      .from(schema.giftClaims)
      .where(and(eq(schema.giftClaims.itemId, item.id), eq(schema.giftClaims.weddingId, wedding.id)));

    const progress = itemProgress(item, existingClaims);
    if (progress.remaining <= 0) {
      return fail("This gift has already been claimed — thank you for checking!");
    }

    const validated = validateGuestClaimInput(raw, progress.remaining);
    if (!validated.ok) {
      return fail("Please check the highlighted fields.", validated.errors);
    }

    await tx.insert(schema.giftClaims).values({
      id: newId(),
      weddingId: wedding.id,
      itemId: item.id,
      giverName: validated.value.giverName,
      giverEmail: validated.value.giverEmail,
      quantity: validated.value.quantity,
      message: validated.value.message,
    });

    return ok("Thank you! We've marked this as gifted.");
  }, { behavior: "immediate" }); // two guests claiming the last one can't both succeed

  if (txResult?.ok) {
    revalidateWedding();
  }
  return txResult;
}

export async function pledgeFundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const fundId = text(formData, "fundId");
  if (!slug || !fundId) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }

  const access = await verifyGuestGiftsAccess(slug);
  if (!access.ok) {
    return fail(access.error);
  }
  const { wedding } = access;
  if (!guestActionLimiter.check(`gift:${wedding.id}:${extractClientIp(await headers())}`).allowed) {
    return fail("Too many in a short time — please wait a minute and try again.");
  }

  const validated = validateGuestPledgeInput({
    giverName: text(formData, "giverName"),
    amount: text(formData, "amount"),
    message: text(formData, "message"),
  });

  if (!validated.ok) {
    return fail("Please check the highlighted fields.", validated.errors);
  }

  const [fund] = await db
    .select()
    .from(schema.cashFunds)
    .where(
      and(
        eq(schema.cashFunds.id, fundId),
        eq(schema.cashFunds.weddingId, wedding.id),
        eq(schema.cashFunds.hidden, false),
      ),
    )
    .limit(1);

  if (!fund) {
    return fail("This cash fund is no longer available.");
  }

  await db.insert(schema.fundContributions).values({
    id: newId(),
    weddingId: wedding.id,
    fundId: fund.id,
    giverName: validated.value.giverName,
    amountCents: validated.value.amountCents,
    message: validated.value.message,
    received: false,
  });

  revalidateWedding();

  const hasDetails = Boolean(fund.paymentInstructions || fund.paymentUrl);
  const reminder = hasDetails
    ? `Thank you! We've let ${wedding.partnerOne} & ${wedding.partnerTwo} know. Please remember to send the money using the payment details above.`
    : `Thank you! We've let ${wedding.partnerOne} & ${wedding.partnerTwo} know. Please remember to send the money directly to the couple.`;

  return ok(reminder);
}
