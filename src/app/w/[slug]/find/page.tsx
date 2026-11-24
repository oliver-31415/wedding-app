import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardBody } from "@/components/ui";
import { InvitationLookup } from "@/components/site/rsvp/invitation-lookup";
import { NotYouButton } from "@/components/site/rsvp/not-you-button";
import { db, schema } from "@/db";
import { householdLabel } from "@/lib/rsvp/model";
import { loadHouseholdRsvpData } from "@/lib/rsvp-guest/load";
import { resolveSafeNext } from "@/lib/rsvp-guest/safe-next";
import { getViewer } from "@/lib/site-access";

export default async function FindInvitationPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/find">) {
  const { slug } = await params;
  const sp = await searchParams;

  const [wedding] = await db
    .select()
    .from(schema.weddings)
    .where(eq(schema.weddings.slug, slug));

  if (!wedding) notFound();

  const viewer = await getViewer(wedding);
  const accentStyle = { "--color-accent": wedding.accentColor } as CSSProperties;

  if (!wedding.published && !viewer.isHost) {
    return (
      <div
        style={accentStyle}
        className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-center"
      >
        <Card className="w-full">
          <CardBody className="space-y-3 p-8">
            <h1 className="font-serif text-3xl font-medium text-ink">
              {wedding.partnerOne} &amp; {wedding.partnerTwo}
            </h1>
            <p className="text-sm text-ink-muted sm:text-base">
              This wedding website isn&apos;t published yet. Check back soon.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const rawNext = typeof sp.next === "string" ? sp.next : null;
  const safeNext = resolveSafeNext(wedding.slug, rawNext, `/w/${wedding.slug}`);

  const loaded = viewer.householdId
    ? await loadHouseholdRsvpData(wedding.id, viewer.householdId)
    : null;

  return (
    <div style={accentStyle} className="mx-auto w-full max-w-2xl">
      {loaded ? (
        <div className="mx-auto w-full max-w-xl space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
              Find your invitation
            </h1>
            <p className="text-sm text-ink-muted sm:text-base">
              You&apos;re currently signed in as{" "}
              <span className="font-medium text-ink">
                {householdLabel(loaded.household, loaded.guests)}
              </span>
              .
            </p>
          </div>

          <Card className="shadow-xs">
            <CardBody className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
              <Link
                href={safeNext}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-6 text-base font-medium text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                Continue
              </Link>
              <NotYouButton
                weddingId={wedding.id}
                slug={wedding.slug}
                label="Not you? Find a different invitation"
              />
            </CardBody>
          </Card>
        </div>
      ) : (
        <InvitationLookup
          weddingId={wedding.id}
          slug={wedding.slug}
          redirectTo={safeNext}
        />
      )}
    </div>
  );
}
