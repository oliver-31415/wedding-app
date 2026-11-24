import type { schema } from "@/db";
import { Card, CardBody, TextBlock } from "@/components/ui";
import { householdLabel, rsvpEventsForHousehold, rsvpWindow } from "@/lib/rsvp/model";
import { loadHouseholdRsvpData } from "@/lib/rsvp-guest/load";
import { pageUrl } from "@/lib/pages";
import type { Viewer } from "@/lib/site-access";
import { sitePath } from "@/lib/site-paths";
import { InvitationLookup } from "./invitation-lookup";
import { NotYouButton } from "./not-you-button";
import { RsvpFlow } from "./rsvp-flow";
import { RsvpSummary } from "./rsvp-summary";

type Wedding = typeof schema.weddings.$inferSelect & { siteBase: string };
type Page = typeof schema.pages.$inferSelect;

export async function RsvpPageBody({
  wedding,
  page,
  viewer,
}: {
  wedding: Wedding;
  page: Page;
  viewer: Viewer;
}) {
  const window = rsvpWindow(wedding);
  const loaded = viewer.householdId
    ? await loadHouseholdRsvpData(wedding.id, viewer.householdId)
    : null;

  const intro = page.body?.trim() ? (
    <div className="mx-auto w-full max-w-2xl text-center text-base leading-relaxed text-ink-muted">
      <TextBlock text={page.body} />
    </div>
  ) : null;

  const notYouRedirectTo =
    !viewer.unlocked && !viewer.isHost && page.visibility !== "public"
      ? `${sitePath(wedding.siteBase, "find")}?next=${encodeURIComponent(pageUrl(wedding.siteBase, page.slug))}`
      : null;

  // 1. RSVPs closed
  if (!window.open) {
    const hasReplied = loaded !== null && (loaded.state === "complete" || loaded.state === "partial");
    return (
      <div className="space-y-8">
        {intro}
        <div className="mx-auto w-full max-w-2xl">
          <Card>
            <CardBody className="space-y-3 p-6 text-center sm:p-8">
              <h2 className="font-serif text-3xl font-medium text-ink">RSVPs are closed</h2>
              {wedding.rsvpClosedMessage?.trim() ? (
                <TextBlock
                  text={wedding.rsvpClosedMessage}
                  className="text-sm leading-relaxed text-ink-muted sm:text-base"
                />
              ) : (
                <p className="text-sm text-ink-muted sm:text-base">RSVPs are now closed.</p>
              )}
            </CardBody>
          </Card>
        </div>

        {hasReplied && loaded && (
          <RsvpSummary
            weddingId={wedding.id}
            slug={wedding.slug}
            summary={loaded.summary}
            canEdit={false}
            notYouRedirectTo={notYouRedirectTo}
          />
        )}
      </div>
    );
  }

  // 2. Not identified (or household cookie points to a deleted household)
  if (!loaded) {
    return (
      <div className="space-y-8">
        {intro}
        <InvitationLookup
          weddingId={wedding.id}
          slug={wedding.slug}
          deadline={wedding.rsvpDeadline}
        />
      </div>
    );
  }

  // 3. Identified, but household has no RSVP events
  const householdEvents = rsvpEventsForHousehold(loaded.guests, loaded.events);
  if (householdEvents.length === 0) {
    const label = householdLabel(loaded.household, loaded.guests);
    return (
      <div className="space-y-8">
        {intro}
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-5">
            <h2 className="font-serif text-3xl font-medium text-ink sm:text-4xl">Hi, {label}</h2>
            <NotYouButton weddingId={wedding.id} slug={wedding.slug} redirectTo={notYouRedirectTo} />
          </div>
          <Card>
            <CardBody className="p-6 text-center sm:p-8">
              <p className="text-base text-ink-muted">
                There aren&apos;t any events needing an RSVP right now. Please check back later or
                get in touch with the couple if you have any questions.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // 4 & 5. Identified with RSVP events -> form or confirmation summary
  return (
    <div className="space-y-8">
      {intro}
      <RsvpFlow
        key={loaded.household.id}
        weddingId={wedding.id}
        slug={wedding.slug}
        household={loaded.household}
        mainGuests={loaded.mainGuests}
        events={loaded.events}
        questions={loaded.questions}
        rsvpState={loaded.state}
        initialSummary={loaded.summary}
        initialFormState={loaded.initialFormState}
        canEdit={wedding.rsvpAllowEdits && window.open}
        deadline={wedding.rsvpDeadline}
        notYouRedirectTo={notYouRedirectTo}
      />
    </div>
  );
}
