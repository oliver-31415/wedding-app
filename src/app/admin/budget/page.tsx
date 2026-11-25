import type { Metadata } from "next";
import Link from "next/link";
import {
  addSuggestedCategoriesAction,
  deleteCategoryAction,
  reorderCategoryAction,
} from "@/app/admin/budget/actions";
import { AddCategoryForm, BudgetTotalForm, EditCategoryForm } from "@/components/admin/budget/forms";
import { BudgetSubNav } from "@/components/admin/budget/parts";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  LinkButton,
  PageHeader,
  Progress,
  ReorderButtons,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { loadBudgetData } from "@/lib/planning-data";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  const { wedding } = await requireHost();
  const { categories, vendors, summary } = await loadBudgetData(wedding);
  const money = (c: number) => formatMoney(c, wedding.currency);
  const vendorCount = new Map<string, number>();
  for (const v of vendors) if (v.categoryId) vendorCount.set(v.categoryId, (vendorCount.get(v.categoryId) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Plan what you’ll spend in each category. Booked vendors count towards it automatically, so you can see an overspend coming."
        actions={
          <LinkButton href="/admin/budget/vendors/new" variant="primary" size="sm">
            Add vendor
          </LinkButton>
        }
      />
      <BudgetSubNav current="/admin/budget" />

      <StatGrid>
        <StatTile
          label="Total budget"
          value={summary.budgetCents === null ? "—" : money(summary.budgetCents)}
          detail={summary.budgetCents === null ? "Set it below" : `${money(summary.estimatedCents)} planned across categories`}
        />
        <StatTile
          label={summary.remainingCents !== null && summary.remainingCents < 0 ? "Forecast over budget" : "Forecast left"}
          value={summary.remainingCents === null ? "—" : money(Math.abs(summary.remainingCents))}
          detail={summary.remainingCents === null ? "Needs a total budget" : "Using the larger of plan or booked, per category"}
        />
        <StatTile label="Booked" value={money(summary.committedCents)} detail={`${vendors.filter((v) => v.status === "booked").length} booked vendors`} href="/admin/budget/vendors" />
        <StatTile
          label="Paid so far"
          value={money(summary.paidCents)}
          detail={
            <>
              <Progress value={summary.paidCents} max={Math.max(summary.committedCents, 1)} tone="good" label="Paid of booked" />
              <span>{money(summary.outstandingCents)} still to pay</span>
            </>
          }
          href="/admin/budget/payments"
        />
      </StatGrid>

      <Card>
        <CardBody>
          <BudgetTotalForm budgetCents={summary.budgetCents} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Categories"
          description="Estimate each category, then compare it with what you’ve booked."
          actions={
            categories.length === 0 ? (
              <form action={addSuggestedCategoriesAction}>
                <Button type="submit" size="sm" variant="secondary">
                  Add suggested categories
                </Button>
              </form>
            ) : undefined
          }
        />
        {summary.categories.length > 0 && (
          <ul className="divide-y divide-line">
            {summary.categories.map((c) => {
              const cat = categories.find((x) => x.id === c.id);
              const i = cat ? categories.indexOf(cat) : -1;
              const over = c.overCents !== null && c.overCents > 0;
              return (
                <li key={c.id ?? "none"} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{c.name}</span>
                      {over && <Badge tone="bad">{money(c.overCents!)} over</Badge>}
                      {c.id && vendorCount.get(c.id) ? (
                        <Link href="/admin/budget/vendors" className="text-sm text-ink-muted hover:text-brand">
                          {vendorCount.get(c.id)} {vendorCount.get(c.id) === 1 ? "vendor" : "vendors"}
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-sm text-ink-muted tabular-nums">
                      <span className="font-medium text-ink">{money(c.committedCents)}</span> booked
                      {c.estimateCents !== null && <> of {money(c.estimateCents)}</>} · {money(c.paidCents)} paid
                    </p>
                  </div>
                  {c.estimateCents !== null && c.estimateCents > 0 && (
                    <Progress value={c.committedCents} max={c.estimateCents} tone={over ? "brand" : "good"} label={`${c.name} booked of estimate`} />
                  )}
                  {cat && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Edit</summary>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <EditCategoryForm category={cat} />
                        <ReorderButtons id={cat.id} action={reorderCategoryAction} isFirst={i === 0} isLast={i === categories.length - 1} label={cat.name} />
                        <form action={deleteCategoryAction}>
                          <input type="hidden" name="id" value={cat.id} />
                          <ConfirmButton
                            confirm={`Delete the “${cat.name}” category?`}
                            detail={vendorCount.get(cat.id) ? `${vendorCount.get(cat.id)} vendors will become uncategorised. Their payments are kept.` : undefined}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <CardBody className={summary.categories.length > 0 ? "border-t border-line" : undefined}>
          <AddCategoryForm />
        </CardBody>
      </Card>
    </div>
  );
}
