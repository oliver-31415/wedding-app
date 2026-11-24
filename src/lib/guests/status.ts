import type { WeddingStats } from "@/lib/stats";

/** Status labels and tones — the shared vocabulary from src/lib/status-words.ts. */
export { GUEST_EVENT_STATUS as GUEST_EVENT_STATUS_META, HOUSEHOLD_STATE as HOUSEHOLD_STATE_META } from "@/lib/status-words";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Summary line on /admin/guests, derived strictly from computeStats().
 * "N guests in N households · N attending · N awaiting reply"
 */
export function formatGuestSummary(stats: WeddingStats): string {
  const awaiting = stats.households.not_started + stats.households.partial;
  return `${plural(stats.guests.total, "guest")} in ${plural(stats.households.total, "household")} · ${stats.attendingAnything} attending · ${awaiting} awaiting reply`;
}
