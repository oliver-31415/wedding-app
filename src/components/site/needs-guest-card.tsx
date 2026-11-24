import Link from "next/link";
import { sitePath } from "@/lib/site-paths";

/**
 * Shown in place of a page only invited guests can see. Deliberately doesn't
 * name the page, so its title isn't revealed to people who aren't on the list.
 */
export function NeedsGuestCard({ siteBase, nextPath }: { siteBase: string; nextPath: string }) {
  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line bg-surface px-6 py-8 text-center">
      <h1 className="font-serif text-3xl font-medium text-ink">For invited guests</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        Find your invitation by name to see this page.
      </p>
      <Link
        href={`${sitePath(siteBase, "find")}?next=${encodeURIComponent(nextPath)}`}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        Find your invitation
      </Link>
    </div>
  );
}
