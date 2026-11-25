import { describe, expect, it } from "vitest";
import {
  computeBudget,
  groupTasks,
  monthsBefore,
  paymentState,
  sortRunSheet,
  suggestedTasks,
  upcomingPayments,
  vendorCost,
  formatClock,
  isClock,
  seatingCandidates,
  type PlanPayment,
  type PlanVendor,
} from "./planning";

const pay = (id: string, vendorId: string, amountCents: number, dueDate: string | null, paidOn: string | null = null): PlanPayment => ({
  id,
  vendorId,
  label: id,
  amountCents,
  dueDate,
  paidOn,
});

describe("vendorCost", () => {
  const v: PlanVendor = { id: "v", name: "Venue", categoryId: "c", status: "booked", quoteCents: 10000 };
  it("uses the quote when payments add up to less", () => {
    expect(vendorCost(v, [pay("a", "v", 3000, null)])).toBe(10000);
  });
  it("uses the payments when they add up to more", () => {
    expect(vendorCost(v, [pay("a", "v", 6000, null), pay("b", "v", 6000, null)])).toBe(12000);
  });
});

describe("computeBudget", () => {
  const categories = [
    { id: "venue", name: "Venue", estimateCents: 2_000_000, position: 0 },
    { id: "photo", name: "Photography", estimateCents: 500_000, position: 1 },
  ];
  const vendors: PlanVendor[] = [
    { id: "hall", name: "Hall", categoryId: "venue", status: "booked", quoteCents: 2_200_000 },
    { id: "snap", name: "Snap", categoryId: "photo", status: "considering", quoteCents: 400_000 },
    { id: "cake", name: "Cake Co", categoryId: null, status: "booked", quoteCents: 80_000 },
  ];
  const payments = [pay("dep", "hall", 500_000, "2026-01-01", "2026-01-01"), pay("bal", "hall", 1_700_000, "2027-02-01")];

  it("only counts booked vendors and adds an Uncategorised row", () => {
    const b = computeBudget(3_000_000, categories, vendors, payments);
    expect(b.categories.map((c) => c.name)).toEqual(["Venue", "Photography", "Uncategorised"]);
    expect(b.committedCents).toBe(2_280_000);
    expect(b.paidCents).toBe(500_000);
    expect(b.outstandingCents).toBe(1_780_000);
    expect(b.categories[0].overCents).toBe(200_000);
    expect(b.categories[1].committedCents).toBe(0);
  });

  it("forecasts remaining from the larger of estimate and committed per line", () => {
    const b = computeBudget(3_000_000, categories, vendors, payments);
    // venue 2.2m (committed > estimate) + photo 0.5m (estimate) + cake 0.08m
    expect(b.remainingCents).toBe(3_000_000 - 2_780_000);
  });

  it("has no remaining figure without a budget", () => {
    expect(computeBudget(null, [], [], []).remainingCents).toBeNull();
  });
});

describe("payments", () => {
  it("classifies payment states", () => {
    const today = "2026-11-25";
    expect(paymentState({ dueDate: "2026-11-01", paidOn: "2026-11-01" }, today)).toBe("paid");
    expect(paymentState({ dueDate: "2026-11-24", paidOn: null }, today)).toBe("overdue");
    expect(paymentState({ dueDate: "2026-12-09", paidOn: null }, today)).toBe("due_soon");
    expect(paymentState({ dueDate: "2026-12-10", paidOn: null }, today)).toBe("upcoming");
    expect(paymentState({ dueDate: null, paidOn: null }, today)).toBe("no_date");
  });

  it("orders unpaid payments by date with undated last", () => {
    const list = upcomingPayments([pay("c", "v", 1, null), pay("b", "v", 1, "2027-01-02"), pay("a", "v", 1, "2026-12-01"), pay("x", "v", 1, "2026-01-01", "2026-01-01")]);
    expect(list.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("checklist", () => {
  it("groups tasks", () => {
    const today = "2026-11-25";
    const groups = groupTasks(
      [
        { id: "1", title: "Late", dueDate: "2026-11-20", doneAt: null, assigneeId: null },
        { id: "2", title: "Soon", dueDate: "2026-11-30", doneAt: null, assigneeId: null },
        { id: "3", title: "Later", dueDate: "2027-01-01", doneAt: null, assigneeId: null },
        { id: "4", title: "Whenever", dueDate: null, doneAt: null, assigneeId: null },
        { id: "5", title: "Done", dueDate: "2026-11-01", doneAt: new Date(), assigneeId: null },
      ],
      today,
    );
    expect(groups.map((g) => [g.key, g.tasks.map((t) => t.id)])).toEqual([
      ["overdue", ["1"]],
      ["this_week", ["2"]],
      ["later", ["3"]],
      ["no_date", ["4"]],
      ["done", ["5"]],
    ]);
  });

  it("works months back, clamping to short months", () => {
    expect(monthsBefore("2027-03-13", 12)).toBe("2026-03-13");
    expect(monthsBefore("2027-03-31", 1)).toBe("2027-02-28");
    expect(monthsBefore("2027-01-15", 2)).toBe("2026-11-15");
  });

  it("suggests tasks without past dates or duplicates", () => {
    const list = suggestedTasks("2027-03-13", "2026-11-25", ["book the venue"]);
    expect(list.find((t) => t.title === "Book the venue")).toBeUndefined();
    expect(list.every((t) => t.dueDate! >= "2026-11-25")).toBe(true);
    expect(suggestedTasks(null, "2026-11-25", []).every((t) => t.dueDate === null)).toBe(true);
  });
});

describe("run sheet", () => {
  it("sorts by time with untimed items last", () => {
    const at = (n: number) => new Date(n);
    const items = sortRunSheet([
      { id: "x", time: null, createdAt: at(1) },
      { id: "b", time: "15:00", createdAt: at(2) },
      { id: "a", time: "09:30", createdAt: at(3) },
    ]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "x"]);
  });

  it("formats and validates clock times", () => {
    expect(formatClock("00:05")).toBe("12:05 am");
    expect(formatClock("15:30")).toBe("3:30 pm");
    expect(isClock("24:00")).toBe(false);
    expect(isClock("09:00")).toBe(true);
  });
});

describe("seatingCandidates", () => {
  it("leaves off guests who declined everything", () => {
    const g = (id: string) => ({ id, householdId: "h", firstName: id, lastName: "X", email: null, ageGroup: "adult" as const, isPlusOne: false, tagIds: [] });
    const events = [
      { id: "cer", name: "Ceremony", audience: { mode: "all" as const }, rsvpEnabled: true, position: 0 },
      { id: "rec", name: "Reception", audience: { mode: "all" as const }, rsvpEnabled: true, position: 1 },
    ];
    const out = seatingCandidates({
      guests: [g("yes"), g("no"), g("wait")],
      events,
      responses: [
        { guestId: "yes", eventId: "cer", attending: false },
        { guestId: "yes", eventId: "rec", attending: true },
        { guestId: "no", eventId: "cer", attending: false },
        { guestId: "no", eventId: "rec", attending: false },
        { guestId: "wait", eventId: "cer", attending: false },
      ],
    });
    expect(out.get("yes")).toBe("attending");
    expect(out.has("no")).toBe(false);
    expect(out.get("wait")).toBe("pending");
    expect(seatingCandidates({ guests: [g("solo")], events: [], responses: [] }).get("solo")).toBe("no_rsvp");
  });
});
