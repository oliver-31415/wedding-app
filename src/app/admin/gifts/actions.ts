"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { bool, fail, moveId, ok, text, type ActionState } from "@/lib/forms";
import {
  parseImageMode,
  resolveImagePlan,
  validateCashFundInput,
  validateGiftItemInput,
  validateOfflineGiftInput,
} from "@/lib/gift-admin/helpers";
import { newId } from "@/lib/ids";
import {
  deleteUpload,
  importImageFromProductPage,
  importImageFromUrl,
  saveUploadedImage,
} from "@/lib/uploads";

function revalidateGiftPaths(slug: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/gifts");
  revalidatePath("/admin/gifts/funds");
  revalidatePath("/admin/gifts/received");
  revalidatePath(`/w/${slug}`, "layout");
  revalidatePath(`/w/${slug}/gifts`);
}

// ---------------------------------------------------------------- gift items

export async function saveGiftItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");

  const result = validateGiftItemInput({
    name: text(formData, "name"),
    url: text(formData, "url"),
    storeName: text(formData, "storeName"),
    price: text(formData, "price"),
    quantityWanted: text(formData, "quantityWanted"),
    mostWanted: bool(formData, "mostWanted"),
    note: text(formData, "note"),
    hidden: bool(formData, "hidden"),
  });

  const imageMode = parseImageMode(text(formData, "imageMode"));
  const rawFile = formData.get("imageFile");
  const imageFile = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  const imageLink = text(formData, "imageLink");

  const planResult = resolveImagePlan({
    isEdit: Boolean(id),
    mode: imageMode,
    hasFile: Boolean(imageFile),
    shopUrl: result.ok ? result.value.url : null,
    shopUrlInvalid: !result.ok && Boolean(result.errors.url),
    imageLink,
  });

  if (!result.ok || !planResult.ok) {
    const errors: Record<string, string> = result.ok ? {} : { ...result.errors };
    if (!planResult.ok) errors.image = planResult.error;
    return fail("Please fix the highlighted fields.", errors);
  }

  const v = result.value;
  const plan = planResult.plan;

  let existing: { id: string; imageUrl: string | null } | undefined;
  if (id) {
    [existing] = await db
      .select({ id: schema.giftItems.id, imageUrl: schema.giftItems.imageUrl })
      .from(schema.giftItems)
      .where(and(eq(schema.giftItems.id, id), eq(schema.giftItems.weddingId, wedding.id)))
      .limit(1);
    if (!existing) return fail("That gift item could not be found.");
  }

  let nextImageUrl: string | null = existing?.imageUrl ?? null;
  let newlyStoredUrl: string | null = null;
  let shouldDeleteOld = false;
  let autoImportFailed = false;

  switch (plan.kind) {
    case "keep":
      break;
    case "remove":
      nextImageUrl = null;
      shouldDeleteOld = true;
      break;
    case "upload": {
      const saved = await saveUploadedImage(imageFile!);
      if (!saved.ok) return fail("Please fix the highlighted fields.", { image: saved.error });
      nextImageUrl = saved.url;
      newlyStoredUrl = saved.url;
      shouldDeleteOld = true;
      break;
    }
    case "url": {
      const saved = await importImageFromUrl(plan.url);
      if (!saved.ok) return fail("Please fix the highlighted fields.", { image: saved.error });
      nextImageUrl = saved.url;
      newlyStoredUrl = saved.url;
      shouldDeleteOld = true;
      break;
    }
    case "shop": {
      const saved = await importImageFromProductPage(plan.url);
      if (saved.ok) {
        nextImageUrl = saved.url;
        newlyStoredUrl = saved.url;
        shouldDeleteOld = true;
      } else if (plan.required) {
        return fail("Please fix the highlighted fields.", { image: saved.error });
      } else {
        nextImageUrl = null;
        autoImportFailed = true;
      }
      break;
    }
  }

  if (id && existing) {
    try {
      await db
        .update(schema.giftItems)
        .set({
          name: v.name,
          url: v.url,
          storeName: v.storeName,
          priceCents: v.priceCents,
          imageUrl: nextImageUrl,
          quantityWanted: v.quantityWanted,
          mostWanted: v.mostWanted,
          note: v.note,
          hidden: v.hidden,
        })
        .where(and(eq(schema.giftItems.id, id), eq(schema.giftItems.weddingId, wedding.id)));
    } catch (err) {
      if (newlyStoredUrl) await deleteUpload(newlyStoredUrl);
      throw err;
    }

    if (shouldDeleteOld && existing.imageUrl && existing.imageUrl !== nextImageUrl) {
      await deleteUpload(existing.imageUrl);
    }

    revalidateGiftPaths(wedding.slug);
    revalidatePath(`/admin/gifts/${id}`);
    return ok("Gift saved.");
  }

  const newItemId = newId();
  try {
    const existingRows = await db
      .select({ id: schema.giftItems.id })
      .from(schema.giftItems)
      .where(eq(schema.giftItems.weddingId, wedding.id));

    await db.insert(schema.giftItems).values({
      id: newItemId,
      weddingId: wedding.id,
      name: v.name,
      url: v.url,
      storeName: v.storeName,
      priceCents: v.priceCents,
      imageUrl: nextImageUrl,
      quantityWanted: v.quantityWanted,
      mostWanted: v.mostWanted,
      note: v.note,
      hidden: v.hidden,
      position: existingRows.length,
    });
  } catch (err) {
    if (newlyStoredUrl) await deleteUpload(newlyStoredUrl);
    throw err;
  }

  revalidateGiftPaths(wedding.slug);
  redirect(autoImportFailed ? `/admin/gifts/${newItemId}?pictureNotice=shop_failed` : "/admin/gifts");
}

export async function reorderGiftItemsAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const rows = await db
    .select({ id: schema.giftItems.id })
    .from(schema.giftItems)
    .where(eq(schema.giftItems.weddingId, wedding.id))
    .orderBy(asc(schema.giftItems.position), asc(schema.giftItems.createdAt));

  const ordered = moveId(
    rows.map((r) => r.id),
    id,
    direction,
  );

  await db.transaction(async (tx) => {
    for (const [position, rowId] of ordered.entries()) {
      await tx
        .update(schema.giftItems)
        .set({ position })
        .where(and(eq(schema.giftItems.id, rowId), eq(schema.giftItems.weddingId, wedding.id)));
    }
  });

  revalidateGiftPaths(wedding.slug);
}

export async function deleteGiftItemAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  const [existing] = await db
    .select({ id: schema.giftItems.id, imageUrl: schema.giftItems.imageUrl })
    .from(schema.giftItems)
    .where(and(eq(schema.giftItems.id, id), eq(schema.giftItems.weddingId, wedding.id)))
    .limit(1);
  if (!existing) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.giftClaims)
      .where(and(eq(schema.giftClaims.itemId, id), eq(schema.giftClaims.weddingId, wedding.id)));
    await tx
      .delete(schema.giftItems)
      .where(and(eq(schema.giftItems.id, id), eq(schema.giftItems.weddingId, wedding.id)));
  });

  await deleteUpload(existing.imageUrl);

  revalidateGiftPaths(wedding.slug);
}

// ---------------------------------------------------------------- cash funds

export async function saveCashFundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");

  const result = validateCashFundInput({
    name: text(formData, "name"),
    description: text(formData, "description"),
    goal: text(formData, "goal"),
    paymentInstructions: text(formData, "paymentInstructions"),
    paymentUrl: text(formData, "paymentUrl"),
    hidden: bool(formData, "hidden"),
  });

  if (!result.ok) {
    return fail("Please fix the highlighted fields.", result.errors);
  }
  const v = result.value;

  if (id) {
    const [existing] = await db
      .select({ id: schema.cashFunds.id })
      .from(schema.cashFunds)
      .where(and(eq(schema.cashFunds.id, id), eq(schema.cashFunds.weddingId, wedding.id)))
      .limit(1);
    if (!existing) return fail("That cash fund could not be found.");

    await db
      .update(schema.cashFunds)
      .set({
        name: v.name,
        description: v.description,
        goalCents: v.goalCents,
        paymentInstructions: v.paymentInstructions,
        paymentUrl: v.paymentUrl,
        hidden: v.hidden,
      })
      .where(and(eq(schema.cashFunds.id, id), eq(schema.cashFunds.weddingId, wedding.id)));

    revalidateGiftPaths(wedding.slug);
    revalidatePath(`/admin/gifts/funds/${id}`);
    return ok("Cash fund saved.");
  }

  const existing = await db
    .select({ id: schema.cashFunds.id })
    .from(schema.cashFunds)
    .where(eq(schema.cashFunds.weddingId, wedding.id));

  await db.insert(schema.cashFunds).values({
    id: newId(),
    weddingId: wedding.id,
    name: v.name,
    description: v.description,
    goalCents: v.goalCents,
    paymentInstructions: v.paymentInstructions,
    paymentUrl: v.paymentUrl,
    hidden: v.hidden,
    position: existing.length,
  });

  revalidateGiftPaths(wedding.slug);
  redirect("/admin/gifts/funds");
}

export async function reorderCashFundsAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const rows = await db
    .select({ id: schema.cashFunds.id })
    .from(schema.cashFunds)
    .where(eq(schema.cashFunds.weddingId, wedding.id))
    .orderBy(asc(schema.cashFunds.position), asc(schema.cashFunds.createdAt));

  const ordered = moveId(
    rows.map((r) => r.id),
    id,
    direction,
  );

  await db.transaction(async (tx) => {
    for (const [position, rowId] of ordered.entries()) {
      await tx
        .update(schema.cashFunds)
        .set({ position })
        .where(and(eq(schema.cashFunds.id, rowId), eq(schema.cashFunds.weddingId, wedding.id)));
    }
  });

  revalidateGiftPaths(wedding.slug);
}

export async function deleteCashFundAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.fundContributions)
      .where(and(eq(schema.fundContributions.fundId, id), eq(schema.fundContributions.weddingId, wedding.id)));
    await tx
      .delete(schema.cashFunds)
      .where(and(eq(schema.cashFunds.id, id), eq(schema.cashFunds.weddingId, wedding.id)));
  });

  revalidateGiftPaths(wedding.slug);
}

// ---------------------------------------------------------------- claims & contributions

export async function toggleContributionReceivedAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  const [row] = await db
    .select({ id: schema.fundContributions.id, received: schema.fundContributions.received })
    .from(schema.fundContributions)
    .where(and(eq(schema.fundContributions.id, id), eq(schema.fundContributions.weddingId, wedding.id)))
    .limit(1);
  if (!row) return;

  await db
    .update(schema.fundContributions)
    .set({ received: !row.received })
    .where(and(eq(schema.fundContributions.id, id), eq(schema.fundContributions.weddingId, wedding.id)));

  revalidateGiftPaths(wedding.slug);
}

export async function toggleContributionThankedAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  const [row] = await db
    .select({ id: schema.fundContributions.id, thankedAt: schema.fundContributions.thankedAt })
    .from(schema.fundContributions)
    .where(and(eq(schema.fundContributions.id, id), eq(schema.fundContributions.weddingId, wedding.id)))
    .limit(1);
  if (!row) return;

  await db
    .update(schema.fundContributions)
    .set({ thankedAt: row.thankedAt ? null : new Date() })
    .where(and(eq(schema.fundContributions.id, id), eq(schema.fundContributions.weddingId, wedding.id)));

  revalidateGiftPaths(wedding.slug);
}

export async function deleteContributionAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  await db
    .delete(schema.fundContributions)
    .where(and(eq(schema.fundContributions.id, id), eq(schema.fundContributions.weddingId, wedding.id)));

  revalidateGiftPaths(wedding.slug);
}

export async function toggleClaimThankedAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  const [row] = await db
    .select({ id: schema.giftClaims.id, thankedAt: schema.giftClaims.thankedAt })
    .from(schema.giftClaims)
    .where(and(eq(schema.giftClaims.id, id), eq(schema.giftClaims.weddingId, wedding.id)))
    .limit(1);
  if (!row) return;

  await db
    .update(schema.giftClaims)
    .set({ thankedAt: row.thankedAt ? null : new Date() })
    .where(and(eq(schema.giftClaims.id, id), eq(schema.giftClaims.weddingId, wedding.id)));

  revalidateGiftPaths(wedding.slug);
}

export async function deleteClaimAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;

  await db
    .delete(schema.giftClaims)
    .where(and(eq(schema.giftClaims.id, id), eq(schema.giftClaims.weddingId, wedding.id)));

  revalidateGiftPaths(wedding.slug);
}

export async function recordOfflineGiftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();

  const result = validateOfflineGiftInput({
    kind: text(formData, "kind"),
    itemId: text(formData, "itemId"),
    fundId: text(formData, "fundId"),
    giverName: text(formData, "giverName"),
    quantity: text(formData, "quantity"),
    amount: text(formData, "amount"),
    message: text(formData, "message"),
  });

  if (!result.ok) {
    return fail("Please fix the highlighted fields.", result.errors);
  }
  const v = result.value;

  if (v.kind === "item") {
    const [item] = await db
      .select({ id: schema.giftItems.id })
      .from(schema.giftItems)
      .where(and(eq(schema.giftItems.id, v.itemId), eq(schema.giftItems.weddingId, wedding.id)))
      .limit(1);
    if (!item) return fail("Choose a valid gift item.", { itemId: "That gift item could not be found." });

    await db.insert(schema.giftClaims).values({
      id: newId(),
      weddingId: wedding.id,
      itemId: v.itemId,
      giverName: v.giverName,
      quantity: v.quantity,
      message: v.message,
    });
  } else {
    const [fund] = await db
      .select({ id: schema.cashFunds.id })
      .from(schema.cashFunds)
      .where(and(eq(schema.cashFunds.id, v.fundId), eq(schema.cashFunds.weddingId, wedding.id)))
      .limit(1);
    if (!fund) return fail("Choose a valid cash fund.", { fundId: "That cash fund could not be found." });

    await db.insert(schema.fundContributions).values({
      id: newId(),
      weddingId: wedding.id,
      fundId: v.fundId,
      giverName: v.giverName,
      amountCents: v.amountCents,
      message: v.message,
      received: true,
    });
  }

  revalidateGiftPaths(wedding.slug);
  return ok("Gift recorded.");
}
