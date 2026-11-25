import Link from "next/link";
import { dueText, PaymentBadge } from "@/components/admin/budget/parts";
import { Badge, Card, CardBody, CardHeader, Progress } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { BudgetSummary } from "@/lib/planning";

export function BudgetCard({ summary, currency }: { summary: BudgetSummary; currency: string }) {
  const money = (c: number) => formatMoney(c, currency);
  const empty = summary.budgetCents === null && summary.categories.length === 0 && summary.committedCents === 0;
  const over = summary.remainingCents !== null && summary.remainingCents < 0;
  return (
    <Card>
      <CardHeader title="Budget" actions={<Link href="/admin/budget" className="text-sm font-medium text-brand hover:underline">Open budget</Link>} />
      <CardBody className="space-y-4">
        {empty ? (
          <p className="text-sm text-ink-muted">
            Set a total and estimate each category to see a live forecast.{" "}
            <Link href="/admin/budget" className="font-medium text-brand hover:underline">
              Set up your budget →
            </Link>
          </p>
        ) : (
          <>
            {summary.remainingCents !== null && (
              <div>
                <p className={over ? "font-serif text-3xl font-medium text-bad" : "font-serif text-3xl font-medium text-ink"}>
                  {money(Math.abs(summary.remainingCents))} {over ? "over" : "under"}
                </p>
                <p className="text-sm text-ink-muted">forecast, of {money(summary.budgetCents!)}</p>
              </div>
            )}
            <Progress value={summary.paidCents} max={Math.max(summary.committedCents, 1)} tone="good" label="Paid of booked" />
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-ink-muted">Booked</dt>
                <dd className="font-medium text-ink tabular-nums">{money(summary.committedCents)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Paid</dt>
                <dd className="font-medium text-ink tabular-nums">{money(summary.paidCents)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">To pay</dt>
                <dd className="font-medium text-ink tabular-nums">{money(summary.outstandingCents)}</dd>
              </div>
            </dl>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function PaymentsDueCard({
  payments,
  today,
  currency,
}: {
  payments: { id: string; label: string; amountCents: number; dueDate: string | null; paidOn: string | null; vendorId: string; vendorName: string }[];
  today: string;
  currency: string;
}) {
  const total = payments.reduce((s, p) => s + p.amountCents, 0);
  return (
    <Card>
      <CardHeader
        title="Vendor payments"
        description={payments.length > 0 ? `${formatMoney(total, currency)} due in the next two weeks or overdue` : undefined}
        actions={<Link href="/admin/budget/payments" className="text-sm font-medium text-brand hover:underline">All payments</Link>}
      />
      {payments.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-muted">Nothing due in the next two weeks.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {payments.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/budget/vendors/${p.vendorId}`} className="group flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink group-hover:text-brand">{p.vendorName}</p>
                  <p className="text-sm text-ink-muted">
                    {p.label} · {dueText(p.dueDate!, today)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PaymentBadge payment={p} today={today} />
                  <span className="text-sm font-medium text-ink tabular-nums">{formatMoney(p.amountCents, currency)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ChecklistCard({
  tasks,
  done,
  total,
  hostName,
}: {
  tasks: { id: string; title: string; dueDate: string | null; assigneeId: string | null; overdue: boolean }[];
  done: number;
  total: number;
  hostName: Map<string, string>;
}) {
  return (
    <Card>
      <CardHeader
        title="Checklist"
        description={total > 0 ? `${done} of ${total} done` : undefined}
        actions={<Link href="/admin/checklist" className="text-sm font-medium text-brand hover:underline">Open checklist</Link>}
      />
      <CardBody className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-ink-muted">
            Start with a suggested checklist worked back from your date.{" "}
            <Link href="/admin/checklist" className="font-medium text-brand hover:underline">
              Add tasks →
            </Link>
          </p>
        ) : (
          <>
            <Progress value={done} max={total} tone="good" label="Checklist progress" />
            {tasks.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing due this week.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink">{t.title}</span>
                    {t.overdue && <Badge tone="bad">Overdue</Badge>}
                    {t.assigneeId && hostName.get(t.assigneeId) && <Badge tone="brand">{hostName.get(t.assigneeId)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
