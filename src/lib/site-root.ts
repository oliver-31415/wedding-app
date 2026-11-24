import "server-only";
import { asc } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import { slugBase } from "@/lib/site-paths";
import { superuserEmails } from "@/lib/superusers";

/**
 * A server without SUPERUSER_EMAILS runs one wedding (e.g. wedding.wright-guys.com)
 * and shows it at the root of the domain. If more than one wedding exists there
 * (only possible in development), the first one created gets the root.
 */
export function servesOneWedding(): boolean {
  return superuserEmails().length === 0;
}

export const getRootWeddingId = cache(async (): Promise<string | null> => {
  if (!servesOneWedding()) return null;
  const [first] = await db
    .select({ id: schema.weddings.id })
    .from(schema.weddings)
    .orderBy(asc(schema.weddings.createdAt), asc(schema.weddings.id))
    .limit(1);
  return first?.id ?? null;
});

/** The wedding's guest-site base for links: "" at the root, else /w/{slug}. */
export async function siteBaseOf(wedding: { id: string; slug: string }): Promise<string> {
  return (await getRootWeddingId()) === wedding.id ? "" : slugBase(wedding.slug);
}
