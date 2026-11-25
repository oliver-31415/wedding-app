"use server";

import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { VENDOR_STATUSES, type VendorStatus } from "@/db/schema";
import { requireHost } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { type ActionState, fail, moveId, ok, text } from "@/lib/forms";
import { newId } from "@/lib/ids";
import { parseMoney } from "@/lib/money";
import { isDate, SUGGESTED_CATEGORIES } from "@/lib/planning";
import { revalidateWedding } from "@/lib/revalidate";

/** Optional money field: null when blank, or an error message. */
function readMoney(formData: FormData, name: string): { cents: number | null } | { error: string } {
  const cents = parseMoney(text(formData, name));
  if (cents !== null && Number.isNaN(cents)) return { error: "Enter an amount like 1500 or 1,500.50." };
  return { cents };
}

// ---------------------------------------------------------------- overall budget and categories

export async function saveBudgetTotalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const budget = readMoney(formData, "budget");
  if ("error" in budget) return fail("Please fix the highlighted fields.", { budget: budget.error });
  await db.update(schema.weddings).set({ budgetCents: budget.cents }).where(eq(schema.weddings.id, wedding.id));
  revalidateWedding();
  return ok(budget.cents === null ? "Budget cleared." : "Budget saved.");
}

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const estimate = readMoney(formData, "estimate");
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter a name.";
  if ("error" in estimate) errors.estimate = estimate.error;
  if (Object.keys(errors).length > 0 || "error" in estimate) return fail("Please fix the highlighted fields.", errors);

  if (id) {
    await db
      .update(schema.budgetCategories)
      .set({ name: name!, estimateCents: estimate.cents })
      .where(and(eq(schema.budgetCategories.id, id), eq(schema.budgetCategories.weddingId, wedding.id)));
    revalidateWedding();
    return ok("Saved.");
  }

  const existing = await db
    .select({ id: schema.budgetCategories.id })
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.weddingId, wedding.id));
  await db.insert(schema.budgetCategories).values({
    id: newId(),
    weddingId: wedding.id,
    name: name!,
    estimateCents: estimate.cents,
    position: existing.length,
  });
  revalidateWedding();
  return ok(`Added ${name}.`);
}

export async function addSuggestedCategoriesAction(): Promise<void> {
  const { wedding } = await requireHost();
  const existing = await db
    .select({ name: schema.budgetCategories.name })
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.weddingId, wedding.id));
  const have = new Set(existing.map((c) => c.name.toLowerCase()));
  const toAdd = SUGGESTED_CATEGORIES.filter((n) => !have.has(n.toLowerCase()));
  if (toAdd.length > 0) {
    await db.insert(schema.budgetCategories).values(
      toAdd.map((name, i) => ({ id: newId(), weddingId: wedding.id, name, position: existing.length + i })),
    );
  }
  revalidateWedding();
}

export async function reorderCategoryAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;
  const rows = await db
    .select({ id: schema.budgetCategories.id })
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.weddingId, wedding.id))
    .orderBy(asc(schema.budgetCategories.position), asc(schema.budgetCategories.createdAt));
  const ordered = moveId(rows.map((r) => r.id), id, direction);
  await Promise.all(
    ordered.map((cid, position) =>
      db
        .update(schema.budgetCategories)
        .set({ position })
        .where(and(eq(schema.budgetCategories.id, cid), eq(schema.budgetCategories.weddingId, wedding.id))),
    ),
  );
  revalidateWedding();
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  // Vendors in this category become uncategorised (FK is ON DELETE SET NULL).
  await db
    .delete(schema.budgetCategories)
    .where(and(eq(schema.budgetCategories.id, id), eq(schema.budgetCategories.weddingId, wedding.id)));
  const rest = await db
    .select({ id: schema.budgetCategories.id })
    .from(schema.budgetCategories)
    .where(eq(schema.budgetCategories.weddingId, wedding.id))
    .orderBy(asc(schema.budgetCategories.position), asc(schema.budgetCategories.createdAt));
  await Promise.all(
    rest.map((c, position) =>
      db
        .update(schema.budgetCategories)
        .set({ position })
        .where(and(eq(schema.budgetCategories.id, c.id), eq(schema.budgetCategories.weddingId, wedding.id))),
    ),
  );
  revalidateWedding();
}

// ---------------------------------------------------------------- vendors

export async function saveVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const quote = readMoney(formData, "quote");
  const statusRaw = text(formData, "status") ?? "considering";
  const categoryId = text(formData, "categoryId");
  const website = text(formData, "website");
  const email = text(formData, "email");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Enter the vendor’s name.";
  if ("error" in quote) errors.quote = quote.error;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (website && !/^https?:\/\//i.test(website) && !/^[\w-]+(\.[\w-]+)+/.test(website)) errors.website = "Enter a web address.";
  if (!VENDOR_STATUSES.includes(statusRaw as VendorStatus)) errors.status = "Choose a status.";
  if (Object.keys(errors).length > 0 || "error" in quote) return fail("Please fix the highlighted fields.", errors);

  if (categoryId) {
    const [cat] = await db
      .select({ id: schema.budgetCategories.id })
      .from(schema.budgetCategories)
      .where(and(eq(schema.budgetCategories.id, categoryId), eq(schema.budgetCategories.weddingId, wedding.id)))
      .limit(1);
    if (!cat) return fail("Please fix the highlighted fields.", { categoryId: "Choose a budget category." });
  }

  const values = {
    name: name!,
    categoryId,
    status: statusRaw as VendorStatus,
    contactName: text(formData, "contactName"),
    email,
    phone: text(formData, "phone"),
    website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
    quoteCents: quote.cents,
    notes: text(formData, "notes"),
  };

  if (id) {
    const updated = await db
      .update(schema.vendors)
      .set(values)
      .where(and(eq(schema.vendors.id, id), eq(schema.vendors.weddingId, wedding.id)))
      .returning({ id: schema.vendors.id });
    if (updated.length === 0) return fail("Vendor not found.");
    revalidateWedding();
    return ok("Vendor saved.");
  }

  const newVendorId = newId();
  await db.insert(schema.vendors).values({ id: newVendorId, weddingId: wedding.id, ...values });
  revalidateWedding();
  redirect(`/admin/budget/vendors/${newVendorId}`);
}

export async function deleteVendorAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db.delete(schema.vendors).where(and(eq(schema.vendors.id, id), eq(schema.vendors.weddingId, wedding.id)));
  revalidateWedding();
  redirect("/admin/budget/vendors");
}

// ---------------------------------------------------------------- payments

export async function addPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const vendorId = text(formData, "vendorId");
  const label = text(formData, "label");
  const amount = readMoney(formData, "amount");
  const dueDate = text(formData, "dueDate");

  const errors: Record<string, string> = {};
  if (!label) errors.label = "Say what this payment is, e.g. Deposit.";
  if ("error" in amount) errors.amount = amount.error;
  else if (amount.cents === null || amount.cents <= 0) errors.amount = "Enter the amount.";
  if (dueDate && !isDate(dueDate)) errors.dueDate = "Enter a valid date.";
  if (Object.keys(errors).length > 0 || "error" in amount) return fail("Please fix the highlighted fields.", errors);

  const [vendor] = vendorId
    ? await db
        .select({ id: schema.vendors.id })
        .from(schema.vendors)
        .where(and(eq(schema.vendors.id, vendorId), eq(schema.vendors.weddingId, wedding.id)))
        .limit(1)
    : [];
  if (!vendor) return fail("Vendor not found.");

  await db.insert(schema.vendorPayments).values({
    id: newId(),
    weddingId: wedding.id,
    vendorId: vendor.id,
    label: label!,
    amountCents: amount.cents!,
    dueDate,
    paidOn: text(formData, "alreadyPaid") ? todayIn(wedding.timeZone) : null,
  });
  revalidateWedding();
  return ok(`Added ${label}.`);
}

export async function togglePaymentPaidAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  const [payment] = await db
    .select({ paidOn: schema.vendorPayments.paidOn })
    .from(schema.vendorPayments)
    .where(and(eq(schema.vendorPayments.id, id), eq(schema.vendorPayments.weddingId, wedding.id)))
    .limit(1);
  if (!payment) return;
  await db
    .update(schema.vendorPayments)
    .set({ paidOn: payment.paidOn ? null : todayIn(wedding.timeZone) })
    .where(and(eq(schema.vendorPayments.id, id), eq(schema.vendorPayments.weddingId, wedding.id)));
  revalidateWedding();
}

export async function deletePaymentAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  if (!id) return;
  await db
    .delete(schema.vendorPayments)
    .where(and(eq(schema.vendorPayments.id, id), eq(schema.vendorPayments.weddingId, wedding.id)));
  revalidateWedding();
}
