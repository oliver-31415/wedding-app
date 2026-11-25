import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeBudget } from "@/lib/planning";

/** Everything the budget, vendor and payment screens (and the dashboard) need. */
export async function loadBudgetData(wedding: { id: string; budgetCents: number | null }) {
  const [categories, vendors, payments] = await Promise.all([
    db
      .select()
      .from(schema.budgetCategories)
      .where(eq(schema.budgetCategories.weddingId, wedding.id))
      .orderBy(asc(schema.budgetCategories.position), asc(schema.budgetCategories.createdAt)),
    db.select().from(schema.vendors).where(eq(schema.vendors.weddingId, wedding.id)).orderBy(asc(schema.vendors.name)),
    db
      .select()
      .from(schema.vendorPayments)
      .where(eq(schema.vendorPayments.weddingId, wedding.id))
      .orderBy(asc(schema.vendorPayments.dueDate), asc(schema.vendorPayments.createdAt)),
  ]);
  return { categories, vendors, payments, summary: computeBudget(wedding.budgetCents, categories, vendors, payments) };
}

/** The wedding's hosts (owner and co-hosts), for assigning tasks. */
export async function loadHosts(weddingId: string) {
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.weddingMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.weddingMembers.userId))
    .where(eq(schema.weddingMembers.weddingId, weddingId))
    .orderBy(asc(schema.weddingMembers.createdAt));
}
