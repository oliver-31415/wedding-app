import Link from "next/link";
import { deletePaymentAction, togglePaymentPaidAction } from "@/app/admin/budget/actions";
import { Badge, Button, ConfirmButton, SubNav } from "@/components/ui";
import { formatDateShort } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { daysBetween, paymentState } from "@/lib/planning";
import { PAYMENT_STATE, VENDOR_STATUS } from "@/lib/status-words";

export function BudgetSubNav({ current }: { current: string }) {
  return (
    <SubNav
      label="Budget"
      current={current}
      items={[
        { href: "/admin/budget", label: "Budget" },
        { href: "/admin/budget/vendors", label: "Vendors" },
        { href: "/admin/budget/payments", label: "Payments" },
      ]}
    />
  );
}

export function VendorStatusBadge({ status }: { status: "considering" | "booked" }) {
  const w = VENDOR_STATUS[status];
  return <Badge tone={w.tone}>{w.label}</Badge>;
}

export function PaymentBadge({ payment, today }: { payment: { dueDate: string | null; paidOn: string | null }; today: string }) {
  const w = PAYMENT_STATE[paymentState(payment, today)];
  return <Badge tone={w.tone}>{w.label}</Badge>;
}

/** "in 9 days" / "today" / "3 days ago" for a due date. */
export function dueText(dueDate: string, today: string): string {
  const d = daysBetween(today, dueDate);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export type PaymentRow = {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string | null;
  paidOn: string | null;
  vendor?: { id: string; name: string };
};

/** One payment with paid toggle and delete. Used on the vendor page and the payment schedule. */
export function PaymentItem({ payment, today, currency }: { payment: PaymentRow; today: string; currency: string }) {
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {payment.vendor ? (
            <Link href={`/admin/budget/vendors/${payment.vendor.id}`} className="font-medium text-ink hover:text-brand hover:underline">
              {payment.vendor.name}
            </Link>
          ) : null}
          <span className={payment.vendor ? "text-ink-muted" : "font-medium text-ink"}>{payment.label}</span>
          <PaymentBadge payment={payment} today={today} />
        </div>
        <p className="text-sm text-ink-muted">
          {payment.paidOn
            ? `Paid ${formatDateShort(payment.paidOn)}`
            : payment.dueDate
              ? `Due ${formatDateShort(payment.dueDate)} · ${dueText(payment.dueDate, today)}`
              : "No due date"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink tabular-nums">{formatMoney(payment.amountCents, currency)}</span>
        <form action={togglePaymentPaidAction}>
          <input type="hidden" name="id" value={payment.id} />
          <Button type="submit" size="sm" variant={payment.paidOn ? "ghost" : "secondary"}>
            {payment.paidOn ? "Mark unpaid" : "Mark paid"}
          </Button>
        </form>
        <form action={deletePaymentAction}>
          <input type="hidden" name="id" value={payment.id} />
          <ConfirmButton confirm={`Delete the payment “${payment.label}”?`} variant="ghost">
            Delete
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}
