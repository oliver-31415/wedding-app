/**
 * Email limits. The live site sends through one email account (Resend's free
 * plan: 100 emails a day, 3000 a month), shared by every wedding on the
 * server. Every email this server sends is recorded in `email_sends`; these
 * pure helpers decide how much room there is and when a bulk message's
 * emails can go. DB access lives in `src/lib/email-usage.ts`.
 *
 * Windows are rolling: the last 24 hours, and the last 31 days (stricter than
 * any calendar-month reset, so always safe). A send at time `s` counts until
 * `s + window`.
 *
 * Bulk messages (save-the-dates, reminders) leave `bulkReserve` emails free
 * in both windows, so one-off emails (RSVP confirmations, password resets,
 * name-check replies) still go out on a busy day.
 */
import { formatDateWeekday, formatInstantTime, todayIn } from "@/lib/dates";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTH_MS = 31 * DAY_MS;

export type EmailLimits = { daily: number; monthly: number; bulkReserve: number };
export type SendKind = "single" | "bulk";

export const DEFAULT_LIMITS: EmailLimits = { daily: 100, monthly: 3000, bulkReserve: 10 };

function intFrom(raw: string | undefined, fallback: number, min: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

/**
 * EMAIL_DAILY_LIMIT (default 100), EMAIL_MONTHLY_LIMIT (default 3000),
 * EMAIL_BULK_RESERVE (default 10). The reserve is capped below the daily
 * limit so bulk messages can always send at least one a day.
 */
export function emailLimits(env: Record<string, string | undefined> = process.env): EmailLimits {
  const daily = intFrom(env.EMAIL_DAILY_LIMIT, DEFAULT_LIMITS.daily, 1);
  const monthly = intFrom(env.EMAIL_MONTHLY_LIMIT, DEFAULT_LIMITS.monthly, 1);
  const reserve = intFrom(env.EMAIL_BULK_RESERVE, DEFAULT_LIMITS.bulkReserve, 0);
  return { daily, monthly, bulkReserve: Math.min(reserve, daily - 1, monthly - 1) };
}

/** The caps that apply to a kind of send: one-off emails may use the reserve, bulk ones may not. */
export function capsFor(limits: EmailLimits, kind: SendKind): { daily: number; monthly: number } {
  const r = kind === "bulk" ? limits.bulkReserve : 0;
  return { daily: Math.max(0, limits.daily - r), monthly: Math.max(0, limits.monthly - r) };
}

/** Sends (unix ms) still counting at `now` in a window of `windowMs`. */
const inWindow = (sends: readonly number[], now: number, windowMs: number) =>
  sends.reduce((n, s) => (s <= now && now - s < windowMs ? n + 1 : n), 0);

export type Usage = { day: number; month: number };

/** How many emails count against each window right now. */
export function usage(sends: readonly number[], now: number): Usage {
  return { day: inWindow(sends, now, DAY_MS), month: inWindow(sends, now, MONTH_MS) };
}

/** How many more emails of this kind can go right now (0 when a limit is reached). */
export function roomNow(sends: readonly number[], now: number, limits: EmailLimits, kind: SendKind): number {
  const caps = capsFor(limits, kind);
  const u = usage(sends, now);
  return Math.max(0, Math.min(caps.daily - u.day, caps.monthly - u.month));
}

/** Which limit stops an email of this kind right now, if any. Daily wins when both are reached. */
export function limitReached(
  sends: readonly number[],
  now: number,
  limits: EmailLimits,
  kind: SendKind,
): "daily" | "monthly" | null {
  const caps = capsFor(limits, kind);
  const u = usage(sends, now);
  if (u.day >= caps.daily) return "daily";
  if (u.month >= caps.monthly) return "monthly";
  return null;
}

export type Batch = { at: number; count: number };
export type SendPlan = {
  /** How many go straight away. */
  now: number;
  /** Later batches, in order: `count` emails can go from about `at` (unix ms). */
  later: Batch[];
  /** Emails that can never go (the limits leave no room for this kind at all). */
  never: number;
};

/**
 * When `count` emails of this kind can go, given past send times. Emails are
 * sent oldest first, so `ahead` emails already waiting in the queue go before
 * these. Each batch starts when older sends age out of a window. Greedy, so a
 * plan for N emails is the first N emails of a plan for more.
 */
export function planSends(
  count: number,
  sends: readonly number[],
  now: number,
  limits: EmailLimits,
  { kind = "bulk", ahead = 0 }: { kind?: SendKind; ahead?: number } = {},
): SendPlan {
  const caps = capsFor(limits, kind);
  const total = Math.max(0, ahead) + Math.max(0, count);
  // Only sends that still count matter; keep them sorted.
  const sim = sends.filter((s) => s <= now && now - s < MONTH_MS).sort((a, b) => a - b);
  const batches: Batch[] = [];
  let remaining = total;
  let t = now;

  if (caps.daily <= 0 || caps.monthly <= 0) return { now: 0, later: [], never: Math.max(0, count) };

  while (remaining > 0) {
    const day = inWindow(sim, t, DAY_MS);
    const month = inWindow(sim, t, MONTH_MS);
    const room = Math.min(caps.daily - day, caps.monthly - month);
    if (room > 0) {
      const n = Math.min(room, remaining);
      batches.push({ at: t, count: n });
      for (let i = 0; i < n; i++) sim.push(t); // t never decreases, so `sim` stays sorted
      remaining -= n;
      continue;
    }
    // Wait until every full window has had its oldest send age out.
    let next = t;
    if (day >= caps.daily) next = Math.max(next, sim.find((s) => t - s < DAY_MS)! + DAY_MS);
    if (month >= caps.monthly) next = Math.max(next, sim.find((s) => t - s < MONTH_MS)! + MONTH_MS);
    if (next <= t) break; // can't happen with positive caps
    t = next;
  }

  // Drop the `ahead` emails from the front.
  let skip = Math.max(0, ahead);
  const mine: Batch[] = [];
  for (const b of batches) {
    const take = Math.max(0, b.count - skip);
    skip = Math.max(0, skip - b.count);
    if (take > 0) mine.push({ at: b.at, count: take });
  }
  const nowCount = mine.filter((b) => b.at <= now).reduce((n, b) => n + b.count, 0);
  return { now: nowCount, later: mine.filter((b) => b.at > now), never: 0 };
}

/** The first `n` emails of a plan (plans are greedy, so this is the plan for `n`). */
export function firstOfPlan(plan: SendPlan, n: number): SendPlan {
  let left = Math.max(0, n);
  const now = Math.min(plan.now, left);
  left -= now;
  const later: Batch[] = [];
  for (const b of plan.later) {
    if (left <= 0) break;
    const take = Math.min(b.count, left);
    later.push({ at: b.at, count: take });
    left -= take;
  }
  return { now, later, never: Math.min(plan.never, left) };
}

/** The earliest time an email of this kind can go (now if there's room). */
export function nextRoomAt(sends: readonly number[], now: number, limits: EmailLimits, kind: SendKind = "single"): number | null {
  const plan = planSends(1, sends, now, limits, { kind });
  if (plan.now) return now;
  return plan.later[0]?.at ?? null;
}

/** How often the queue timer runs (src/instrumentation.ts). Estimates round up to it. */
export const QUEUE_INTERVAL_MS = 5 * 60 * 1000;

/** Rounds an estimate up to the next 5 minutes, so "about 7:05 pm" isn't promised to the minute. */
export function roundUpEstimate(at: number): number {
  return Math.ceil(at / QUEUE_INTERVAL_MS) * QUEUE_INTERVAL_MS;
}

/** Later batches grouped by calendar day in `timeZone`: how many go that day, and from when. */
export function laterByDay(later: readonly Batch[], timeZone: string): { date: string; from: number; count: number }[] {
  const days: { date: string; from: number; count: number }[] = [];
  for (const b of later) {
    // Grouped by the rounded time that's shown, so 11:57 pm (shown as 12:00 am) joins the next day.
    const at = roundUpEstimate(b.at);
    const date = todayIn(timeZone, at);
    const last = days[days.length - 1];
    if (last && last.date === date) last.count += b.count;
    else days.push({ date, from: at, count: b.count });
  }
  return days;
}

/** The calendar day after "YYYY-MM-DD" (not now + 24 hours, which daylight saving can skew). */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "7:05 pm", "7:05 pm tomorrow" or "7:05 pm on Saturday 28 November", relative to `now`. */
export function describeWhen(at: number, now: number, timeZone: string): string {
  const time = formatInstantTime(at, timeZone);
  const day = todayIn(timeZone, at);
  if (day === todayIn(timeZone, now)) return time;
  if (day === nextDay(todayIn(timeZone, now))) return `${time} tomorrow`;
  return `${time} on ${formatDateWeekday(day)}`;
}

/** "tomorrow", "today" or "on Saturday 28 November" for a day ("YYYY-MM-DD"). */
function dayWords(date: string, now: number, timeZone: string): string {
  if (date === todayIn(timeZone, now)) return "later today";
  if (date === nextDay(todayIn(timeZone, now))) return "tomorrow";
  return `on ${formatDateWeekday(date)}`;
}

/**
 * The plan in words, e.g. "90 go now and the other 52 tomorrow from about
 * 7:10 pm." or "90 go now, 90 tomorrow from about 7:10 pm and the other 20
 * on Saturday 28 November from about 7:15 pm." Empty when everything goes now.
 */
export function describePlan(plan: SendPlan, now: number, timeZone: string): string {
  if (!plan.later.length && !plan.never) return "";
  const parts: string[] = [];
  if (plan.now) parts.push(`${plan.now} go now`);
  const days = laterByDay(plan.later, timeZone);
  days.forEach((d, i) => {
    const last = i === days.length - 1;
    const n = last && parts.length ? `the other ${d.count}` : `${d.count}`;
    parts.push(`${n} ${dayWords(d.date, now, timeZone)} from about ${formatInstantTime(d.from, timeZone)}`);
  });
  let text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "");
  if (plan.never) {
    text += `${text ? ". " : ""}${plan.never} can't be sent: the email limits leave no room for messages to guests`;
  }
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
