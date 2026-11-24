import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Call after any write a host or guest makes. Pages are rendered per request,
 * so this mainly refreshes the client router cache — but it's the one call
 * that guarantees both the admin (dashboard numbers, checklists) and the
 * guest site (nav, pages, schedule) show the change straight away. It covers
 * every path because the guest site may be served at the root of the domain.
 */
export function revalidateWedding(): void {
  revalidatePath("/", "layout");
}
