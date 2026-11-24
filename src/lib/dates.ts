/**
 * Wedding times are wall-clock strings ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm")
 * in the wedding's IANA time zone. These helpers are the only place that
 * converts them to instants or formats them.
 */

const LOCALE = "en-AU";

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "YYYY-MM-DDTHH:mm[:ss]" in `timeZone` → unix ms. Ambiguous times (clocks
 * going back) resolve to the earlier instant; times skipped when clocks go
 * forward resolve to just after the jump.
 */
export function wallTimeToInstant(wall: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(wall);
  if (!m) throw new Error(`Invalid wall time: ${wall}`);
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // The offset either side of any transition near this time.
  const before = zoneOffsetMs(guess - 86_400_000, timeZone);
  const after = zoneOffsetMs(guess + 86_400_000, timeZone);
  const valid = [guess - before, guess - after].filter((t) => zoneOffsetMs(t, timeZone) === guess - t);
  if (valid.length) return Math.min(...valid);
  return guess - before; // in a spring-forward gap
}

/** The last millisecond of `date` in `timeZone`. */
export function endOfDay(date: string, timeZone: string): number {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return wallTimeToInstant(`${next}T00:00`, timeZone) - 1;
}

/** Today's date ("YYYY-MM-DD") in `timeZone`. */
export function todayIn(timeZone: string, now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function wallToUtcDate(wall: string): Date {
  // Formatting only: treat the wall clock as UTC and format in UTC, so no zone shifts happen.
  const [d, t = "00:00"] = wall.split("T");
  return new Date(`${d}T${t}:00Z`);
}

/** "Saturday 14 March 2027" */
export function formatDateLong(date: string): string {
  return wallToUtcDate(date).toLocaleDateString(LOCALE, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "14 Mar 2027" */
export function formatDateShort(date: string): string {
  return wallToUtcDate(date).toLocaleDateString(LOCALE, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "3:30 pm" */
export function formatTime(wall: string): string {
  return wallToUtcDate(wall).toLocaleTimeString(LOCALE, { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
}

/** "3:30 pm – 11:00 pm", "3:30 pm", or "Time to be announced". */
export function formatTimeRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "Time to be announced";
  if (!endsAt) return formatTime(startsAt);
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** Relative "3 days ago" style for activity feeds. */
export function formatRelative(instant: number, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const diff = instant - now;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  return "just now";
}

/** Whole days from today until `date` in `timeZone` (negative once past). */
export function daysUntil(date: string, timeZone: string, now = Date.now()): number {
  const today = Date.parse(`${todayIn(timeZone, now)}T00:00:00Z`);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}
