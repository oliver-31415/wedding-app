import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Call after any write a host or guest makes. Pages are rendered per request,
 * so this mainly refreshes the client router cache — but it's the one call
 * that guarantees both the admin (dashboard numbers, checklists) and the
 * guest site (nav, pages, schedule) show the change straight away.
 */
export function revalidateWedding(slug: string, ...oldSlugs: string[]): void {
  revalidatePath("/admin", "layout");
  for (const s of [slug, ...oldSlugs]) revalidatePath(`/w/${s}`, "layout");
}
