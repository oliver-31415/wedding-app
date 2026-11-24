import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/nav";
import { SiteBadge } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { isSuperuser } from "@/lib/superusers";

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, wedding } = await requireHost();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="space-y-1.5 px-1">
            <p className="font-serif text-xl leading-tight font-medium">
              {wedding.partnerOne} &amp; {wedding.partnerTwo}
            </p>
            <div className="flex items-center gap-2">
              <SiteBadge published={wedding.published} />
              <a href={`/w/${wedding.slug}`} target="_blank" className="text-sm text-brand hover:underline">
                View site ↗
              </a>
              <form action="/logout" method="post" className="ml-auto md:hidden">
                <button className="text-sm text-ink-muted hover:text-ink">Sign out</button>
              </form>
            </div>
          </div>
          <AdminNav />
          {isSuperuser(user.email) && (
            <a href="/site-admin" className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-sunken hover:text-ink">
              Site admin
            </a>
          )}
          <div className="mt-auto hidden space-y-2 border-t border-line px-1 pt-4 text-sm md:block">
            <p className="truncate text-ink-muted">{user.email}</p>
            <form action="/logout" method="post">
              <button className="text-ink-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
