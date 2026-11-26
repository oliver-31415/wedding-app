/**
 * Jobs and helpers on the Day of run sheet. Each run sheet item can have
 * jobs, and each job has helpers. Pure rules only (no database), shared by
 * the admin, the helper's own page (/helper/{token}) and tests. Job times are
 * "HH:mm" on the wedding day; null = no set time (it happens at the item's time).
 */
import { formatClock, isClock, sortRunSheet } from "@/lib/planning";

export type JobTimes = { startTime: string | null; endTime: string | null };
export type OrderableJob = JobTimes & { position: number; createdAt?: Date | number | null };

/** "9:05" / "09:05" / "09:05:00" → "09:05"; anything else → null. */
export function parseTime(raw: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((raw ?? "").trim());
  if (!m) return null;
  const t = `${m[1].padStart(2, "0")}:${m[2]}`;
  return isClock(t) ? t : null;
}

export type ParsedJobTimes =
  | { ok: true; startTime: string | null; endTime: string | null }
  | { ok: false; errors: Partial<Record<"startTime" | "endTime", string>> };

/** Validates a job's start and (optional) end time. The end must be after the start. */
export function parseJobTimes(startRaw: string | null | undefined, endRaw: string | null | undefined): ParsedJobTimes {
  const startBlank = !(startRaw ?? "").trim();
  const endBlank = !(endRaw ?? "").trim();
  const startTime = startBlank ? null : parseTime(startRaw);
  const endTime = endBlank ? null : parseTime(endRaw);
  const errors: Partial<Record<"startTime" | "endTime", string>> = {};
  if (!startBlank && !startTime) errors.startTime = "Enter a time like 2:30 pm.";
  if (!endBlank && !endTime) errors.endTime = "Enter a time like 3:00 pm.";
  else if (endTime && startBlank) errors.endTime = "Add a start time, or clear the end time.";
  else if (endTime && startTime && endTime <= startTime) errors.endTime = "The end time must be after the start time.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, startTime, endTime };
}

const createdMs = (j: OrderableJob) => (j.createdAt == null ? 0 : typeof j.createdAt === "number" ? j.createdAt : j.createdAt.getTime());

/** Order within an item: by start time (then end time); jobs with no set time last, by position. */
export function compareJobs(a: OrderableJob, b: OrderableJob): number {
  if (a.startTime && b.startTime) {
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    const ae = a.endTime ?? "";
    const be = b.endTime ?? "";
    if (ae !== be) return ae < be ? -1 : 1;
  } else if (a.startTime) return -1;
  else if (b.startTime) return 1;
  return a.position - b.position || createdMs(a) - createdMs(b);
}

export function sortJobs<T extends OrderableJob>(jobs: readonly T[]): T[] {
  return [...jobs].sort(compareJobs);
}

/** "2:30 pm – 3:00 pm", "2:30 pm", or null when the job has no set time. */
export function formatJobTime(job: JobTimes): string | null {
  if (!job.startTime) return null;
  return job.endTime ? `${formatClock(job.startTime)} – ${formatClock(job.endTime)}` : formatClock(job.startTime);
}

export type Assignment = { jobId: string; helperId: string };

/** jobId → helper ids, in the order given. */
export function helpersByJob(assignments: readonly Assignment[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const a of assignments) {
    const list = out.get(a.jobId);
    if (list) list.push(a.helperId);
    else out.set(a.jobId, [a.helperId]);
  }
  return out;
}

/** How many of `jobs` have nobody assigned. */
export function countUnassigned(jobs: readonly { id: string }[], assignments: readonly Assignment[]): number {
  const assigned = new Set(assignments.map((a) => a.jobId));
  return jobs.filter((j) => !assigned.has(j.id)).length;
}

/** "4 jobs · 1 with no one yet", "1 job", or null when there are none. */
export function describeJobCount(total: number, unassigned: number): string | null {
  if (total === 0) return null;
  const jobs = `${total} ${total === 1 ? "job" : "jobs"}`;
  return unassigned > 0 ? `${jobs} · ${unassigned} with no one yet` : jobs;
}

export type RunItemLike = { id: string; time: string | null; createdAt: Date };
export type ItemJob = OrderableJob & { id: string; runSheetItemId: string };
export type ItemGroup<I, J> = { item: I; jobs: J[] };

/** Every run sheet item (run sheet order, via `sortRunSheet`) with its jobs in order. */
export function groupJobsByItem<I extends RunItemLike, J extends ItemJob>(items: readonly I[], jobs: readonly J[]): ItemGroup<I, J>[] {
  return sortRunSheet([...items]).map((item) => ({ item, jobs: sortJobs(jobs.filter((j) => j.runSheetItemId === item.id)) }));
}

/** One helper's jobs grouped by run sheet item, in run sheet order. Items they have no jobs at are left out. */
export function groupHelperJobs<I extends RunItemLike, J extends ItemJob>(
  helperId: string,
  items: readonly I[],
  jobs: readonly J[],
  assignments: readonly Assignment[],
): ItemGroup<I, J>[] {
  const mine = new Set(assignments.filter((a) => a.helperId === helperId).map((a) => a.jobId));
  return groupJobsByItem(items, jobs.filter((j) => mine.has(j.id))).filter((g) => g.jobs.length > 0);
}

/** A helper's name with their role, e.g. "Jess (Bridesmaid)". */
export const helperLabel = (h: { name: string; role: string | null }) => (h.role ? `${h.name} (${h.role})` : h.name);

/** First word of a name, for greetings ("Hi Jess"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * A new secret for a helper's page link: 24 random bytes, base64url (32
 * characters), the same shape as `newToken()` in src/lib/ids.ts. Uses Web
 * Crypto so this file stays usable anywhere.
 */
export function newHelperToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const HELPER_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
