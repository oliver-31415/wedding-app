import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getWeddingBySlug } from "@/components/site/site-data";
import { UnlockForm } from "@/components/site/unlock-form";
import { safeNextPath } from "@/lib/pages";
import { getViewer } from "@/lib/site-access";

export const metadata: Metadata = {
  title: "Enter password",
};

export default async function UnlockPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/unlock">) {
  const { slug } = await params;
  const sp = await searchParams;
  const wedding = await getWeddingBySlug(slug);
  if (!wedding) notFound();

  const viewer = await getViewer(wedding);
  if (!wedding.published && !viewer.isHost) return null;

  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const nextPath = safeNextPath(rawNext, wedding.slug);

  if (!viewer.isHost && (viewer.unlocked || viewer.householdId)) {
    redirect(nextPath);
  }

  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line bg-surface px-6 py-8 text-center">
      <h1 className="font-serif text-3xl font-medium text-ink">Password required</h1>
      {!wedding.sitePassword ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          This page is for invited guests.{" "}
          <a className="text-accent underline" href={`/w/${wedding.slug}/find?next=${encodeURIComponent(nextPath)}`}>
            Find your invitation
          </a>{" "}
          to see it.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">Enter the password from your invitation to continue.</p>
          <UnlockForm weddingSlug={wedding.slug} nextPath={nextPath} />
          <p className="mt-4 text-sm text-ink-muted">
            Or{" "}
            <a className="text-accent underline" href={`/w/${wedding.slug}/find?next=${encodeURIComponent(nextPath)}`}>
              find your invitation by name
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
