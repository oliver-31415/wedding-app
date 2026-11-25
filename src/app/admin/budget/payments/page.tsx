import type { Metadata } from "next";
import { BudgetSubNav, PaymentItem } from "@/components/admin/budget/parts";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, StatGrid, StatTile } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { DUE_SOON_DAYS, paymentState, upcomingPayments } from "@/lib/planning";
import { loadBudgetData } from "@/lib/planning-data";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const { wedding } = await requireHost();
  const { vendors, payments } = await loadBudgetData(wedding);
  const today = todayIn(wedding.timeZone);
  const vendorById = new Map(vendors.map((v) => [v.id, { id: v.id, name: v.name }]));
  const rows = payments.map((p) => ({ ...p, vendor: vendorById.get(p.vendorId) }));
  const unpaid = upcomingPayments(rows);
  const paid = rows.filter((p) => p.paidOn).sort((a, b) => b.paidOn!.localeCompare(a.paidOn!));
  const sum = (list: typeof rows) => list.reduce((s, p) => s + p.amountCents, 0);
  const overdue = unpaid.filter((p) => paymentState(p, today) === "overdue");
  const soon = unpaid.filter((p) => paymentState(p, today) === "due_soon");
  const money = (c: number) => formatMoney(c, wedding.currency);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Every deposit and balance across your vendors, in the order they’re due." />
      <BudgetSubNav current="/admin/budget/payments" />

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          body="Open a vendor and add their deposit and final balance with due dates. They’ll all appear here."
          action={
            <LinkButton href="/admin/budget/vendors" variant="primary">
              Go to vendors
            </LinkButton>
          }
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Overdue" value={money(sum(overdue))} detail={`${overdue.length} ${overdue.length === 1 ? "payment" : "payments"}`} />
            <StatTile label={`Due in ${DUE_SOON_DAYS} days`} value={money(sum(soon))} detail={`${soon.length} ${soon.length === 1 ? "payment" : "payments"}`} />
            <StatTile label="Still to pay" value={money(sum(unpaid))} detail={`${unpaid.length} ${unpaid.length === 1 ? "payment" : "payments"}`} />
            <StatTile label="Paid" value={money(sum(paid))} detail={`${paid.length} ${paid.length === 1 ? "payment" : "payments"}`} />
          </StatGrid>

          {unpaid.length > 0 && (
            <Card>
              <CardHeader title="To pay" />
              <ul className="divide-y divide-line">
                {unpaid.map((p) => (
                  <PaymentItem key={p.id} payment={p} today={today} currency={wedding.currency} />
                ))}
              </ul>
            </Card>
          )}
          {paid.length > 0 && (
            <Card>
              <CardHeader title="Paid" />
              <ul className="divide-y divide-line">
                {paid.map((p) => (
                  <PaymentItem key={p.id} payment={p} today={today} currency={wedding.currency} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
