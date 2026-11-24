import type { schema } from "@/db";

type Wedding = typeof schema.weddings.$inferSelect;
export type PublicWedding = Omit<Wedding, "sitePassword">;

/**
 * The wedding row minus secrets. Anything passed to a "use client" component
 * is sent to the browser, so client components get this, never the full row.
 */
export function toPublicWedding(wedding: Wedding): PublicWedding {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sitePassword, ...rest } = wedding;
  return rest;
}
