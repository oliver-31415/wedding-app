import type { Metadata } from "next";
import Link from "next/link";
import { BudgetSubNav, VendorStatusBadge } from "@/components/admin/budget/parts";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { paymentState, vendorCost } from "@/lib/planning";
import { loadBudgetData } from "@/lib/planning-data";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const { wedding } = await requireHost();
  const { categories, vendors, payments } = await loadBudgetData(wedding);
  const today = todayIn(wedding.timeZone);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const groups = [
    { title: "Booked", description: "Counted in your budget.", list: vendors.filter((v) => v.status === "booked") },
    { title: "Considering", description: "Quotes you’re comparing. Not counted in your budget yet.", list: vendors.filter((v) => v.status === "considering") },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Keep every supplier’s contact details, quote, notes and payments in one place."
        actions={
          <LinkButton href="/admin/budget/vendors/new" variant="primary" size="sm">
            Add vendor
          </LinkButton>
        }
      />
      <BudgetSubNav current="/admin/budget/vendors" />

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          body="Add the venue, photographer, florist and anyone else you’re talking to. Compare quotes, then mark them booked."
          action={
            <LinkButton href="/admin/budget/vendors/new" variant="primary">
              Add vendor
            </LinkButton>
          }
        />
      ) : (
        groups.map((g) => (
          <Card key={g.title}>
            <CardHeader title={`${g.title} (${g.list.length})`} description={g.description} />
            <ul className="divide-y divide-line">
              {g.list.map((v) => {
                const own = payments.filter((p) => p.vendorId === v.id);
                const paid = own.filter((p) => p.paidOn).reduce((s, p) => s + p.amountCents, 0);
                const overdue = own.filter((p) => paymentState(p, today) === "overdue").length;
                const cost = vendorCost(v, own);
                return (
                  <li key={v.id}>
                    <Link href={`/admin/budget/vendors/${v.id}`} className="group flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink group-hover:text-brand">{v.name}</span>
                          <VendorStatusBadge status={v.status} />
                          {overdue > 0 && <span className="text-sm font-medium text-bad">{overdue} overdue</span>}
                        </div>
                        <p className="text-sm text-ink-muted">
                          {[v.categoryId ? catName.get(v.categoryId) : null, v.contactName, v.phone].filter(Boolean).join(" · ") || "No details yet"}
                        </p>
                      </div>
                      <p className="text-sm text-ink-muted tabular-nums">
                        {cost > 0 ? (
                          <>
                            <span className="font-medium text-ink">{formatMoney(cost, wedding.currency)}</span>
                            {v.status === "booked" && <> · {formatMoney(paid, wedding.currency)} paid</>}
                          </>
                        ) : (
                          "No quote yet"
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
