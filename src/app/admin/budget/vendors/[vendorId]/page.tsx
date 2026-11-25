import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteVendorAction } from "@/app/admin/budget/actions";
import { AddPaymentForm, VendorForm } from "@/components/admin/budget/forms";
import { PaymentItem, VendorStatusBadge } from "@/components/admin/budget/parts";
import { BackLink, Card, CardBody, CardHeader, ConfirmButton, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { upcomingPayments, vendorCost } from "@/lib/planning";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ params }: PageProps<"/admin/budget/vendors/[vendorId]">) {
  const { vendorId } = await params;
  const { wedding } = await requireHost();
  const [vendor] = await db
    .select()
    .from(schema.vendors)
    .where(and(eq(schema.vendors.id, vendorId), eq(schema.vendors.weddingId, wedding.id)))
    .limit(1);
  if (!vendor) notFound();

  const [categories, payments] = await Promise.all([
    db
      .select({ id: schema.budgetCategories.id, name: schema.budgetCategories.name })
      .from(schema.budgetCategories)
      .where(eq(schema.budgetCategories.weddingId, wedding.id))
      .orderBy(asc(schema.budgetCategories.position)),
    db
      .select()
      .from(schema.vendorPayments)
      .where(and(eq(schema.vendorPayments.vendorId, vendor.id), eq(schema.vendorPayments.weddingId, wedding.id))),
  ]);
  const today = todayIn(wedding.timeZone);
  const ordered = [...upcomingPayments(payments), ...payments.filter((p) => p.paidOn).sort((a, b) => a.paidOn!.localeCompare(b.paidOn!))];
  const scheduled = payments.reduce((s, p) => s + p.amountCents, 0);
  const paid = payments.filter((p) => p.paidOn).reduce((s, p) => s + p.amountCents, 0);
  const cost = vendorCost(vendor, payments);
  const money = (c: number) => formatMoney(c, wedding.currency);

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href="/admin/budget/vendors">Vendors</BackLink>}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {vendor.name} <VendorStatusBadge status={vendor.status} />
          </span>
        }
        description={cost > 0 ? `${money(cost)} total · ${money(paid)} paid · ${money(cost - paid)} to go` : undefined}
        actions={
          <form action={deleteVendorAction}>
            <input type="hidden" name="id" value={vendor.id} />
            <ConfirmButton confirm={`Delete ${vendor.name}?`} detail={payments.length ? `Its ${payments.length} payments will be deleted too.` : undefined}>
              Delete vendor
            </ConfirmButton>
          </form>
        }
      />

      <Card>
        <CardHeader
          title="Payments"
          description={
            vendor.quoteCents !== null && scheduled < vendor.quoteCents
              ? `${money(vendor.quoteCents - scheduled)} of the quote isn’t scheduled yet.`
              : "Deposits and balances. Anything due within two weeks shows on your dashboard."
          }
        />
        {ordered.length > 0 && (
          <ul className="divide-y divide-line">
            {ordered.map((p) => (
              <PaymentItem key={p.id} payment={p} today={today} currency={wedding.currency} />
            ))}
          </ul>
        )}
        <CardBody className={ordered.length > 0 ? "border-t border-line" : undefined}>
          <AddPaymentForm vendorId={vendor.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <VendorForm vendor={vendor} categories={categories} />
        </CardBody>
      </Card>
    </div>
  );
}
