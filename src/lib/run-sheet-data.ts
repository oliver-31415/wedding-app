import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "@/lib/email-layout";
import { HELPER_TOKEN_RE, type Assignment } from "@/lib/run-sheet";

/** Loading jobs, helpers and who's on what (Day of run sheet). Rules live in src/lib/run-sheet.ts. */

export type Job = typeof schema.jobs.$inferSelect;
export type Helper = typeof schema.helpers.$inferSelect;

/** A helper's personal page, as an absolute link for emails and copying. */
export const helperUrl = (token: string) => `${appUrl()}/helper/${token}`;

export type RunItem = typeof schema.runSheetItems.$inferSelect;

export async function loadJobs(weddingId: string): Promise<Job[]> {
  return db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.weddingId, weddingId))
    .orderBy(asc(schema.jobs.position), asc(schema.jobs.createdAt));
}

export async function loadHelpers(weddingId: string): Promise<Helper[]> {
  return db
    .select()
    .from(schema.helpers)
    .where(eq(schema.helpers.weddingId, weddingId))
    .orderBy(asc(schema.helpers.position), asc(schema.helpers.createdAt));
}

/** Who's on which job, for this wedding's jobs only (optionally just some jobs). */
export async function loadAssignments(weddingId: string, jobIds?: string[]): Promise<Assignment[]> {
  if (jobIds && jobIds.length === 0) return [];
  return db
    .select({ jobId: schema.jobHelpers.jobId, helperId: schema.jobHelpers.helperId })
    .from(schema.jobHelpers)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobHelpers.jobId))
    .innerJoin(schema.helpers, eq(schema.helpers.id, schema.jobHelpers.helperId))
    .where(
      and(
        eq(schema.jobs.weddingId, weddingId),
        eq(schema.helpers.weddingId, weddingId),
        jobIds ? inArray(schema.jobHelpers.jobId, jobIds) : undefined,
      ),
    )
    .orderBy(asc(schema.helpers.position), asc(schema.helpers.createdAt));
}

/** Run sheet items (unsorted: order them with `sortRunSheet` / `groupJobsByItem`). */
export async function loadRunItems(weddingId: string): Promise<RunItem[]> {
  return db.select().from(schema.runSheetItems).where(eq(schema.runSheetItems.weddingId, weddingId));
}

/** Everything the run sheet and helpers pages show. */
export async function loadRunSheet(weddingId: string) {
  const [items, jobs, helpers, assignments] = await Promise.all([
    loadRunItems(weddingId),
    loadJobs(weddingId),
    loadHelpers(weddingId),
    loadAssignments(weddingId),
  ]);
  return { items, jobs, helpers, assignments };
}

/**
 * The helper behind a /helper/{token} link, with their wedding. Works whether
 * or not the wedding site is published: the link itself is the permission.
 */
export async function resolveHelperLink(token: string) {
  if (!HELPER_TOKEN_RE.test(token)) return null;
  const [row] = await db
    .select({ helper: schema.helpers, wedding: schema.weddings })
    .from(schema.helpers)
    .innerJoin(schema.weddings, eq(schema.weddings.id, schema.helpers.weddingId))
    .where(eq(schema.helpers.token, token))
    .limit(1);
  return row ?? null;
}
