import { describe, expect, it } from "vitest";
import {
  capsFor,
  DAY_MS,
  describePlan,
  describeWhen,
  emailLimits,
  firstOfPlan,
  laterByDay,
  limitReached,
  MONTH_MS,
  nextRoomAt,
  planSends,
  roomNow,
  roundUpEstimate,
  usage,
  type EmailLimits,
} from "./email-quota";

const TZ = "Australia/Sydney";
// Thursday 26 November 2026, 7:00 pm in Sydney (UTC+11).
const NOW = Date.UTC(2026, 10, 26, 8, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const LIMITS: EmailLimits = { daily: 100, monthly: 3000, bulkReserve: 10 };

/** `n` sends at `at`, one a second. */
const burst = (n: number, at: number) => Array.from({ length: n }, (_, i) => at + i * 1000);
const sum = (plan: ReturnType<typeof planSends>) => plan.now + plan.later.reduce((n, b) => n + b.count, 0);

describe("emailLimits", () => {
  it("defaults to 100 a day, 3000 a month and a reserve of 10", () => {
    expect(emailLimits({})).toEqual({ daily: 100, monthly: 3000, bulkReserve: 10 });
  });
  it("reads the environment and ignores nonsense", () => {
    expect(emailLimits({ EMAIL_DAILY_LIMIT: "50", EMAIL_MONTHLY_LIMIT: "1000", EMAIL_BULK_RESERVE: "0" })).toEqual({
      daily: 50,
      monthly: 1000,
      bulkReserve: 0,
    });
    expect(emailLimits({ EMAIL_DAILY_LIMIT: "lots", EMAIL_MONTHLY_LIMIT: "-5", EMAIL_BULK_RESERVE: "2.5" })).toEqual(
      emailLimits({}),
    );
  });
  it("keeps the reserve below the daily limit so bulk can still send", () => {
    expect(emailLimits({ EMAIL_DAILY_LIMIT: "5" }).bulkReserve).toBe(4);
    expect(capsFor(emailLimits({ EMAIL_DAILY_LIMIT: "5" }), "bulk").daily).toBe(1);
  });
});

describe("room now", () => {
  it("counts the last 24 hours and the last 31 days", () => {
    const sends = [NOW - DAY_MS - 1, NOW - DAY_MS + 1, NOW - MONTH_MS + 1, NOW - MONTH_MS - 1, NOW];
    expect(usage(sends, NOW)).toEqual({ day: 2, month: 4 });
  });
  it("leaves the reserve free for one-off emails", () => {
    const sends = burst(85, NOW - HOUR);
    expect(roomNow(sends, NOW, LIMITS, "single")).toBe(15);
    expect(roomNow(sends, NOW, LIMITS, "bulk")).toBe(5);
    const busy = burst(92, NOW - HOUR);
    expect(roomNow(busy, NOW, LIMITS, "bulk")).toBe(0);
    expect(roomNow(busy, NOW, LIMITS, "single")).toBe(8);
  });
  it("says which limit is reached", () => {
    expect(limitReached(burst(100, NOW - HOUR), NOW, LIMITS, "single")).toBe("daily");
    expect(limitReached(burst(99, NOW - HOUR), NOW, LIMITS, "single")).toBeNull();
    const month = burst(3000, NOW - 10 * DAY_MS);
    expect(limitReached(month, NOW, LIMITS, "single")).toBe("monthly");
    expect(limitReached(burst(90, NOW - HOUR), NOW, LIMITS, "bulk")).toBe("daily");
  });
  it("finds when the next one-off email can go", () => {
    const sends = burst(100, NOW - 2 * HOUR);
    expect(nextRoomAt(sends, NOW, LIMITS)).toBe(NOW - 2 * HOUR + DAY_MS);
    expect(nextRoomAt([], NOW, LIMITS)).toBe(NOW);
  });
});

describe("planSends", () => {
  it("sends everything now when there's room", () => {
    expect(planSends(40, burst(20, NOW - HOUR), NOW, LIMITS)).toEqual({ now: 40, later: [], never: 0 });
  });

  it("splits a big send across two days as yesterday's emails age out", () => {
    const plan = planSends(142, [], NOW, LIMITS);
    expect(plan.now).toBe(90);
    expect(plan.later).toEqual([{ at: NOW + DAY_MS, count: 52 }]);
  });

  it("frees room as older sends age out, in the order they were sent", () => {
    // 30 sent 20 hours ago, 60 sent 2 hours ago: 0 bulk room now.
    const sends = [...burst(30, NOW - 20 * HOUR), ...burst(60, NOW - 2 * HOUR)];
    const plan = planSends(70, sends, NOW, LIMITS);
    expect(plan.now).toBe(0);
    expect(plan.later[0]).toEqual({ at: NOW - 20 * HOUR + DAY_MS, count: 1 });
    expect(sum(plan)).toBe(70);
    // First 30 go about 4 hours from now, the other 40 about 22 hours from now.
    const firstDay = plan.later.filter((b) => b.at < NOW + 5 * HOUR).reduce((n, b) => n + b.count, 0);
    expect(firstDay).toBe(30);
    expect(plan.later.at(-1)!.at).toBeLessThan(NOW + 23 * HOUR);
  });

  it("spans three or more days", () => {
    const plan = planSends(250, [], NOW, LIMITS);
    expect(plan.now).toBe(90);
    expect(plan.later).toEqual([
      { at: NOW + DAY_MS, count: 90 },
      { at: NOW + 2 * DAY_MS, count: 70 },
    ]);
    expect(laterByDay(plan.later, TZ).map((d) => d.date)).toEqual(["2026-11-27", "2026-11-28"]);
  });

  it("waits for the monthly limit when that binds", () => {
    // 2985 sent over the last month (none in the last 24 hours) leaves 5 bulk emails this month.
    const sends = Array.from({ length: 2985 }, (_, i) => NOW - MONTH_MS + DAY_MS + i * 10 * MIN);
    expect(roomNow(sends, NOW, LIMITS, "bulk")).toBe(5);
    const plan = planSends(20, sends, NOW, LIMITS);
    expect(plan.now).toBe(5);
    // The rest go one by one, as the oldest sends reach 31 days old.
    expect(plan.later[0].at).toBe(sends[0] + MONTH_MS);
    expect(sum(plan)).toBe(20);
    expect(plan.later.at(-1)!.at).toBe(sends[14] + MONTH_MS);
  });

  it("needs both windows to have room", () => {
    // Monthly room only opens in 2 days; daily room is free now.
    const old = Array.from({ length: 2990 }, (_, i) => NOW - MONTH_MS + 2 * DAY_MS + i);
    const plan = planSends(3, old, NOW, LIMITS);
    expect(plan.now).toBe(0);
    expect(plan.later[0].at).toBe(old[0] + MONTH_MS);
    expect(sum(plan)).toBe(3);
  });

  it("puts emails already waiting in the queue first", () => {
    const plan = planSends(50, [], NOW, LIMITS, { ahead: 70 });
    expect(plan.now).toBe(20);
    expect(plan.later).toEqual([{ at: NOW + DAY_MS, count: 30 }]);
    // A plan for fewer emails is the start of a plan for more.
    expect(planSends(10, [], NOW, LIMITS, { ahead: 85 })).toEqual({ now: 5, later: [{ at: NOW + DAY_MS, count: 5 }], never: 0 });
  });

  it("takes the first emails of a bigger plan", () => {
    const sends = [...burst(30, NOW - 20 * HOUR), ...burst(40, NOW - 2 * HOUR)];
    const big = planSends(200, sends, NOW, LIMITS, { ahead: 3 });
    for (const n of [0, 5, 20, 21, 60, 133, 200]) {
      expect(firstOfPlan(big, n)).toEqual(planSends(n, sends, NOW, LIMITS, { ahead: 3 }));
    }
  });

  it("keeps the reserve for one-off emails but not for one-off plans", () => {
    expect(planSends(100, [], NOW, LIMITS, { kind: "single" }).now).toBe(100);
    expect(planSends(100, [], NOW, LIMITS).now).toBe(90);
  });

  it("handles limits lowered below what's already been sent", () => {
    const sends = burst(100, NOW - HOUR);
    const plan = planSends(5, sends, NOW, { daily: 20, monthly: 3000, bulkReserve: 2 });
    expect(plan.now).toBe(0);
    // 82 of the 100 have to age out before there's room again.
    expect(plan.later[0].at).toBe(sends[82] + DAY_MS);
    expect(sum(plan)).toBe(5);
  });

  it("says when nothing can go at all", () => {
    expect(planSends(5, [], NOW, { daily: 10, monthly: 10, bulkReserve: 10 })).toEqual({ now: 0, later: [], never: 5 });
  });
});

describe("words", () => {
  it("rounds estimates up to the next 5 minutes", () => {
    expect(roundUpEstimate(NOW + 1)).toBe(NOW + 5 * MIN);
    expect(roundUpEstimate(NOW)).toBe(NOW);
  });

  it("describes when relative to today", () => {
    expect(describeWhen(NOW + 5 * MIN, NOW, TZ)).toBe("7:05 pm");
    expect(describeWhen(NOW + DAY_MS + 10 * MIN, NOW, TZ)).toBe("7:10 pm tomorrow");
    expect(describeWhen(NOW + 2 * DAY_MS, NOW, TZ)).toBe("7:00 pm on Saturday 28 November");
  });

  it("describes a two-day plan", () => {
    const plan = planSends(142, [], NOW + 7 * MIN, LIMITS);
    expect(describePlan(plan, NOW, TZ)).toBe("90 go now and the other 52 tomorrow from about 7:10 pm.");
  });

  it("describes a three-day plan", () => {
    expect(describePlan(planSends(250, [], NOW, LIMITS), NOW, TZ)).toBe(
      "90 go now, 90 tomorrow from about 7:00 pm and the other 70 on Saturday 28 November from about 7:00 pm.",
    );
  });

  it("describes a plan where nothing goes now", () => {
    const plan = planSends(10, burst(90, NOW - 20 * HOUR), NOW, LIMITS);
    expect(describePlan(plan, NOW, TZ)).toBe("10 later today from about 11:00 pm.");
  });

  it("is empty when everything goes now", () => {
    expect(describePlan(planSends(5, [], NOW, LIMITS), NOW, TZ)).toBe("");
  });
});
