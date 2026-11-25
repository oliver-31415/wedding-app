/**
 * Pure rules for the host-only planning tools (budget, vendor payments,
 * checklist, seating, run sheet). Every planning number shown to hosts comes
 * from here, so the dashboard and the section pages always agree.
 */

import { guestEventStatus, responsesMap, type SnapEvent, type SnapGuest, type SnapResponse } from "@/lib/rsvp/model";

// ---------------------------------------------------------------- budget

export type PlanCategory = { id: string; name: string; estimateCents: number | null; position: number };
export type PlanVendor = {
  id: string;
  name: string;
  categoryId: string | null;
  status: "considering" | "booked";
  quoteCents: number | null;
};
export type PlanPayment = {
  id: string;
  vendorId: string;
  label: string;
  amountCents: number;
  dueDate: string | null;
  paidOn: string | null;
};

/** What a booked vendor costs: the quote, or the payments scheduled if they add up to more. */
export function vendorCost(vendor: PlanVendor, payments: PlanPayment[]): number {
  const scheduled = payments.filter((p) => p.vendorId === vendor.id).reduce((s, p) => s + p.amountCents, 0);
  return Math.max(vendor.quoteCents ?? 0, scheduled);
}

export type CategorySummary = {
  id: string | null;
  name: string;
  estimateCents: number | null;
  /** Booked vendors' costs in this category. */
  committedCents: number;
  paidCents: number;
  /** committed − estimate (positive = over). Null when no estimate. */
  overCents: number | null;
};

export type BudgetSummary = {
  budgetCents: number | null;
  estimatedCents: number;
  committedCents: number;
  paidCents: number;
  /** Booked but not paid yet. */
  outstandingCents: number;
  /** budget − max(estimated, committed) per category (positive = room left). Null without a budget. */
  remainingCents: number | null;
  categories: CategorySummary[];
};

export function computeBudget(
  budgetCents: number | null,
  categories: PlanCategory[],
  vendors: PlanVendor[],
  payments: PlanPayment[],
): BudgetSummary {
  const booked = vendors.filter((v) => v.status === "booked");
  const known = new Set(categories.map((c) => c.id));
  const rows = [...categories]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id as string | null, name: c.name, estimateCents: c.estimateCents }));
  if (booked.some((v) => !v.categoryId || !known.has(v.categoryId))) {
    rows.push({ id: null, name: "Uncategorised", estimateCents: null });
  }

  const summaries: CategorySummary[] = rows.map((row) => {
    const inRow = booked.filter((v) => (row.id === null ? !v.categoryId || !known.has(v.categoryId) : v.categoryId === row.id));
    const ids = new Set(inRow.map((v) => v.id));
    const committedCents = inRow.reduce((s, v) => s + vendorCost(v, payments), 0);
    const paidCents = payments.filter((p) => ids.has(p.vendorId) && p.paidOn).reduce((s, p) => s + p.amountCents, 0);
    return {
      ...row,
      committedCents,
      paidCents,
      overCents: row.estimateCents === null ? null : committedCents - row.estimateCents,
    };
  });

  const estimatedCents = summaries.reduce((s, c) => s + (c.estimateCents ?? 0), 0);
  const committedCents = summaries.reduce((s, c) => s + c.committedCents, 0);
  const paidCents = summaries.reduce((s, c) => s + c.paidCents, 0);
  // Forecast = for each line, whichever is bigger: what you planned or what you've signed up for.
  const forecast = summaries.reduce((s, c) => s + Math.max(c.estimateCents ?? 0, c.committedCents), 0);

  return {
    budgetCents,
    estimatedCents,
    committedCents,
    paidCents,
    outstandingCents: committedCents - paidCents,
    remainingCents: budgetCents === null ? null : budgetCents - forecast,
    categories: summaries,
  };
}

export type PaymentState = "paid" | "overdue" | "due_soon" | "upcoming" | "no_date";

/** "Due soon" means within this many days. */
export const DUE_SOON_DAYS = 14;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function paymentState(payment: Pick<PlanPayment, "dueDate" | "paidOn">, today: string): PaymentState {
  if (payment.paidOn) return "paid";
  if (!payment.dueDate) return "no_date";
  const days = daysBetween(today, payment.dueDate);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due_soon";
  return "upcoming";
}

/** Unpaid payments in the order they need paying: overdue, then by date, undated last. */
export function upcomingPayments<T extends PlanPayment>(payments: T[]): T[] {
  return payments
    .filter((p) => !p.paidOn)
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.label.localeCompare(b.label);
    });
}

/** Opt-in starter categories (added only when the couple clicks the button). */
export const SUGGESTED_CATEGORIES = [
  "Venue",
  "Catering & drinks",
  "Photography & video",
  "Attire & rings",
  "Flowers & styling",
  "Music & entertainment",
  "Hair & makeup",
  "Celebrant",
  "Cake",
  "Stationery",
  "Transport",
  "Accommodation",
  "Favours & gifts",
  "Honeymoon",
] as const;

// ---------------------------------------------------------------- checklist

export type PlanTask = { id: string; title: string; dueDate: string | null; doneAt: Date | null; assigneeId: string | null };

export type TaskGroupKey = "overdue" | "this_week" | "later" | "no_date" | "done";
export const TASK_GROUP_LABEL: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  this_week: "Due this week",
  later: "Coming up",
  no_date: "No due date",
  done: "Done",
};

export function taskGroup(task: Pick<PlanTask, "dueDate" | "doneAt">, today: string): TaskGroupKey {
  if (task.doneAt) return "done";
  if (!task.dueDate) return "no_date";
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return "overdue";
  if (days <= 7) return "this_week";
  return "later";
}

/** Tasks grouped for the checklist, each group sorted by due date then title. */
export function groupTasks<T extends PlanTask>(tasks: T[], today: string): { key: TaskGroupKey; tasks: T[] }[] {
  const order: TaskGroupKey[] = ["overdue", "this_week", "later", "no_date", "done"];
  const byKey = new Map<TaskGroupKey, T[]>(order.map((k) => [k, []]));
  for (const t of tasks) byKey.get(taskGroup(t, today))!.push(t);
  return order
    .map((key) => ({
      key,
      tasks: byKey.get(key)!.sort((a, b) => {
        if (key === "done") return (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0);
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.title.localeCompare(b.title);
      }),
    }))
    .filter((g) => g.tasks.length > 0);
}

/**
 * Opt-in starter checklist: [title, months before the wedding].
 * Added only when the couple clicks "Add suggested tasks".
 */
export const SUGGESTED_TASKS: [string, number][] = [
  ["Set your overall budget", 12],
  ["Draft the guest list", 12],
  ["Book the venue", 12],
  ["Book the celebrant", 11],
  ["Book the photographer", 11],
  ["Book catering (if not with the venue)", 10],
  ["Send save-the-dates", 9],
  ["Choose wedding attire", 9],
  ["Book music — band or DJ", 9],
  ["Book florist", 8],
  ["Book hair and makeup", 7],
  ["Plan the honeymoon", 7],
  ["Order the cake", 6],
  ["Book transport", 6],
  ["Send invitations", 4],
  ["Lodge the Notice of Intended Marriage (at least one month before)", 3],
  ["Buy the rings", 3],
  ["Final dress fittings", 2],
  ["Chase outstanding RSVPs", 2],
  ["Finish the seating plan", 1],
  ["Confirm final numbers with the caterer", 1],
  ["Send the day-of run sheet to vendors", 1],
  ["Pay final vendor balances", 1],
  ["Write vows and speeches", 1],
];

/** `date` minus `months` months, clamped to the end of shorter months. */
export function monthsBefore(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/**
 * Suggested tasks with due dates worked back from the wedding date. Tasks
 * whose date has already passed are due today instead, so nothing starts
 * overdue. Titles the couple already has are skipped.
 */
export function suggestedTasks(
  weddingDate: string | null,
  today: string,
  existingTitles: string[],
): { title: string; dueDate: string | null }[] {
  const have = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return SUGGESTED_TASKS.filter(([title]) => !have.has(title.toLowerCase())).map(([title, months]) => {
    if (!weddingDate) return { title, dueDate: null };
    const due = monthsBefore(weddingDate, months);
    return { title, dueDate: due < today ? today : due };
  });
}

// ---------------------------------------------------------------- run sheet

/** Timed items in time order, then untimed ones in the order they were added. */
export function sortRunSheet<T extends { time: string | null; createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || a.createdAt.getTime() - b.createdAt.getTime();
    if (a.time) return -1;
    if (b.time) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/** "HH:mm" → "3:30 pm". */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function isClock(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

// ---------------------------------------------------------------- seating

export type SeatingStatus = "attending" | "pending" | "no_rsvp";

/**
 * Who belongs on the seating plan: everyone except guests who have declined
 * every event they were asked about. Uses the same RSVP rules as the stats.
 */
export function seatingCandidates(snapshot: {
  guests: SnapGuest[];
  events: SnapEvent[];
  responses: SnapResponse[];
}): Map<string, SeatingStatus> {
  const responses = responsesMap(snapshot.responses);
  const byHousehold = new Map<string, SnapGuest[]>();
  for (const g of snapshot.guests) byHousehold.set(g.householdId, [...(byHousehold.get(g.householdId) ?? []), g]);
  const out = new Map<string, SeatingStatus>();
  for (const g of snapshot.guests) {
    const members = byHousehold.get(g.householdId) ?? [g];
    const statuses = snapshot.events.map((e) => guestEventStatus(g, e, members, responses)).filter((s) => s !== "not_invited");
    if (statuses.length === 0) out.set(g.id, "no_rsvp");
    else if (statuses.includes("attending")) out.set(g.id, "attending");
    else if (statuses.includes("pending")) out.set(g.id, "pending");
    // declined everything: left off the plan
  }
  return out;
}
