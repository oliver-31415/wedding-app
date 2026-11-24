import Link from "next/link";
import type { ReactNode } from "react";
import { GiftsPageBody } from "@/components/site/gifts/gifts-page-body";
import { CoverPhoto } from "@/components/site/photos/cover-photo";
import { PhotoGallery } from "@/components/site/photos/photo-gallery";
import { SitePhotoImg } from "@/components/site/photos/site-photo";
import { RsvpPageBody } from "@/components/site/rsvp/rsvp-page-body";
import { getPageItems, getWeddingEvents, getWeddingTagNames } from "@/components/site/site-data";
import { cn, TextBlock } from "@/components/ui";
import type { schema } from "@/db";
import { describeAudience } from "@/lib/audience";
import { formatDateLong, formatTimeRange } from "@/lib/dates";
import { eventNeedsGuest, visibleEvents } from "@/lib/event-visibility";
import { buildGoogleCalendarUrl, buildGoogleMapsUrl, pageUrl } from "@/lib/pages";
import { getCoverPhoto, getGalleryPhotos, getItemPhotos } from "@/lib/photos";
import { DEFAULT_FOCUS, type SitePhoto } from "@/lib/photos-shared";
import type { SnapGuest } from "@/lib/rsvp/model";
import type { Viewer } from "@/lib/site-access";
import { sitePath } from "@/lib/site-paths";
import type { SiteStyleSpec } from "@/lib/site-styles";

/** `siteBase`: where the guest site lives (src/lib/site-paths.ts). */
type Wedding = typeof schema.weddings.$inferSelect & { siteBase: string };
type Page = typeof schema.pages.$inferSelect;
type Event = Awaited<ReturnType<typeof getWeddingEvents>>[number];
type Item = Awaited<ReturnType<typeof getPageItems>>[number];

/**
 * Renders one guest-site page in the couple's chosen style. Colours and
 * fonts come from the CSS tokens the site shell sets (text-ink, bg-surface,
 * border-line, text-accent, font-serif …); the layout of each section comes
 * from `style.layout`.
 */
export async function SitePageView({
  wedding,
  page,
  viewer,
  householdGuests,
  style,
}: {
  wedding: Wedding;
  page: Page;
  viewer: Viewer;
  householdGuests: SnapGuest[];
  style: SiteStyleSpec;
}) {
  const t = typography(style);
  const hiddenBanner =
    viewer.isHost && page.visibility === "hidden" ? (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-line bg-sunken px-4 py-2.5 text-xs">
        <span className="text-ink">Hidden page — guests can&rsquo;t see this</span>
        <span className="flex items-center gap-3">
          <Link href={`/admin/website/${page.id}`} className="font-medium text-accent underline">
            Edit page
          </Link>
          <Link href="/admin" className="text-ink-muted underline">
            Back to admin
          </Link>
        </span>
      </div>
    ) : null;

  if (page.type === "home") {
    const coverPhoto = await getCoverPhoto(wedding.id);
    return (
      <div className={style.id === "minimal" ? "space-y-9 sm:space-y-12" : "space-y-10"}>
        {hiddenBanner && <div className={cn("mx-auto", t.width)}>{hiddenBanner}</div>}
        {coverPhoto && (
          <CoverPhoto
            photo={coverPhoto}
            partnerOne={wedding.partnerOne}
            partnerTwo={wedding.partnerTwo}
            styleId={style.id}
          />
        )}
        {page.body?.trim() ? (
          <div
            className={cn(
              "mx-auto text-lg leading-relaxed text-ink sm:text-xl",
              t.width,
              t.align,
              style.id === "garden" && "font-serif text-2xl sm:text-3xl",
            )}
          >
            <TextBlock text={page.body} />
          </div>
        ) : null}
      </div>
    );
  }

  // RSVP and gift bodies render their own intro.
  const showIntro = page.type !== "rsvp" && page.type !== "gifts" && !!page.body?.trim();
  let body: ReactNode = null;

  if (page.type === "schedule") {
    const [all, tagNames] = await Promise.all([
      getWeddingEvents(wedding.id),
      viewer.isHost ? getWeddingTagNames(wedding.id) : Promise.resolve(new Map<string, string>()),
    ]);
    const { events, promptToIdentify } = visibleEvents(all, viewer, householdGuests);
    body = (
      <div className="space-y-8">
        {events.length > 0 && (
          <Schedule
            events={events}
            wedding={wedding}
            style={style}
            hostNote={(e) =>
              viewer.isHost && eventNeedsGuest(e)
                ? e.audience.mode === "tags"
                  ? describeAudience(e.audience, tagNames)
                  : "Only invited guests can see this"
                : null
            }
          />
        )}
        {promptToIdentify && (
          <IdentifyPrompt
            siteBase={wedding.siteBase}
            next={pageUrl(wedding.siteBase, page.slug)}
            style={style}
            text="Some details are only shown to invited guests."
          />
        )}
      </div>
    );
  } else if (page.type === "story") {
    const [items, photos] = await Promise.all([
      getPageItems(wedding.id, page.id),
      getItemPhotos(wedding.id, page.id),
    ]);
    if (items.length) body = <Story items={items} photos={photos} style={style} />;
  } else if (page.type === "party") {
    const [items, photos] = await Promise.all([
      getPageItems(wedding.id, page.id),
      getItemPhotos(wedding.id, page.id),
    ]);
    if (items.length) body = <Party items={items} photos={photos} style={style} />;
  } else if (page.type === "photos") {
    const photos = await getGalleryPhotos(wedding.id, page.id);
    if (photos.length) body = <PhotoGallery photos={photos} styleId={style.id} />;
  } else if (page.type === "faq") {
    const items = await getPageItems(wedding.id, page.id);
    if (items.length) body = <Faq items={items} style={style} />;
  } else if (page.type === "rsvp") {
    body = (
      <div className={cn("mx-auto", t.width)}>
        <RsvpPageBody wedding={wedding} page={page} viewer={viewer} />
      </div>
    );
  } else if (page.type === "gifts") {
    body = <GiftsPageBody wedding={wedding} page={page} viewer={viewer} />;
  }

  return (
    <div className="space-y-10">
      {hiddenBanner}
      <header className={cn("mx-auto space-y-3", t.width, t.align)}>
        <h1 className={t.pageHeading}>{page.title}</h1>
        {showIntro && (
          <div className="text-base leading-relaxed text-ink-muted">
            <TextBlock text={page.body} />
          </div>
        )}
      </header>
      {body}
    </div>
  );
}

// ------------------------------------------------------------ typography

function typography(style: SiteStyleSpec) {
  const scale = style.layout.headingScale;
  return {
    align: style.layout.alignment === "center" ? "text-center" : "text-left",
    width: style.layout.maxWidth === "narrow" ? "max-w-xl" : style.layout.maxWidth === "wide" ? "max-w-4xl" : "max-w-2xl",
    pageHeading: {
      classic: "font-serif text-4xl font-medium text-ink sm:text-5xl",
      compact: "font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl",
      expressive: "font-serif text-4xl font-medium text-ink sm:text-6xl",
      dramatic: "font-serif text-5xl leading-[0.95] font-medium text-ink sm:text-7xl",
      understated: "font-serif text-sm font-medium tracking-[0.35em] text-ink uppercase",
    }[scale],
    itemHeading: {
      classic: "font-serif text-2xl font-medium text-ink",
      compact: "font-serif text-lg font-semibold tracking-tight text-ink",
      expressive: "font-serif text-3xl font-medium text-ink",
      dramatic: "font-serif text-3xl font-medium text-ink sm:text-4xl",
      understated: "font-serif text-base font-medium tracking-wide text-ink",
    }[scale],
  };
}

const eyebrow = "text-xs font-medium tracking-[0.2em] text-accent uppercase";

// ------------------------------------------------------------ schedule

function EventDetails({ event, wedding, compact = false }: { event: Event; wedding: Wedding; compact?: boolean }) {
  const gcalUrl = event.startsAt ? buildGoogleCalendarUrl(wedding, { ...event, startsAt: event.startsAt }) : null;
  const icsUrl = event.startsAt ? sitePath(wedding.siteBase, `event/${event.id}.ics`) : null;
  const mapsUrl = event.address ? buildGoogleMapsUrl(event.venueName, event.address) : null;
  return (
    <div className={cn("space-y-2 text-sm", compact ? "text-ink-muted" : "")}>
      {(event.venueName || event.address) && (
        <div className="space-y-0.5">
          {event.venueName && <p className="font-medium text-ink">{event.venueName}</p>}
          {event.address && (
            <p className="flex flex-wrap items-baseline gap-x-2 text-ink-muted">
              <span>{event.address}</span>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                  Map ↗
                </a>
              )}
            </p>
          )}
        </div>
      )}
      {event.dressCode && (
        <p className="text-ink-muted">
          <span className="font-medium text-ink">Dress code:</span> {event.dressCode}
        </p>
      )}
      {event.description && (
        <div className="leading-relaxed text-ink-muted">
          <TextBlock text={event.description} />
        </div>
      )}
      {gcalUrl && icsUrl && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs font-medium">
          <a href={gcalUrl} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            Add to Google Calendar ↗
          </a>
          <a href={icsUrl} className="text-accent underline underline-offset-2">
            Add to Apple / Outlook calendar
          </a>
        </p>
      )}
    </div>
  );
}

function when(event: Event) {
  return {
    date: event.startsAt ? formatDateLong(event.startsAt) : null,
    time: formatTimeRange(event.startsAt, event.endsAt),
  };
}

function HostNote({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{text}</p>;
}

function Schedule({
  events,
  wedding,
  style,
  hostNote,
}: {
  events: Event[];
  wedding: Wedding;
  style: SiteStyleSpec;
  hostNote: (e: Event) => string | null;
}) {
  const t = typography(style);
  switch (style.layout.schedule) {
    case "compact-list":
      return (
        <ol className={cn("mx-auto divide-y divide-line border-y border-line", t.width)}>
          {events.map((e) => {
            const w = when(e);
            return (
              <li key={e.id} className="grid gap-3 py-6 sm:grid-cols-[11rem_1fr] sm:gap-8">
                <div className="text-sm">
                  <p className="font-semibold text-ink">{w.time}</p>
                  {w.date && <p className="text-ink-muted">{w.date}</p>}
                </div>
                <div className="space-y-2">
                  <HostNote text={hostNote(e)} />
                  <h2 className={t.itemHeading}>{e.name}</h2>
                  <EventDetails event={e} wedding={wedding} compact />
                </div>
              </li>
            );
          })}
        </ol>
      );
    case "timeline":
      return (
        <ol className={cn("relative mx-auto space-y-8 border-l-2 border-accent/30 pl-8 text-left", t.width)}>
          {events.map((e) => {
            const w = when(e);
            return (
              <li key={e.id} className="relative">
                <span aria-hidden className="absolute top-1.5 -left-[2.6rem] size-4 rounded-full border-4 border-canvas bg-accent" />
                <div className="space-y-2 rounded-[var(--radius-card)] bg-surface p-6">
                  <HostNote text={hostNote(e)} />
                  <p className={eyebrow}>
                    {[w.date, w.time].filter(Boolean).join(" · ")}
                  </p>
                  <h2 className={t.itemHeading}>{e.name}</h2>
                  <EventDetails event={e} wedding={wedding} />
                </div>
              </li>
            );
          })}
        </ol>
      );
    case "editorial-stack":
      return (
        <ol className={cn("mx-auto space-y-0", t.width)}>
          {events.map((e, i) => {
            const w = when(e);
            return (
              <li key={e.id} className="grid gap-4 border-t border-ink py-8 sm:grid-cols-[3rem_1fr]">
                <span className="font-serif text-3xl text-accent">{String(i + 1).padStart(2, "0")}</span>
                <div className="space-y-3">
                  <HostNote text={hostNote(e)} />
                  <h2 className={t.itemHeading}>{e.name}</h2>
                  <p className={eyebrow}>{[w.date, w.time].filter(Boolean).join(" · ")}</p>
                  <EventDetails event={e} wedding={wedding} />
                </div>
              </li>
            );
          })}
        </ol>
      );
    case "centered-list":
      return (
        <ol className={cn("mx-auto space-y-14 text-center", t.width)}>
          {events.map((e) => {
            const w = when(e);
            return (
              <li key={e.id} className="space-y-3">
                <HostNote text={hostNote(e)} />
                <h2 className={t.itemHeading}>{e.name}</h2>
                <p className="text-xs tracking-[0.25em] text-ink-muted uppercase">{[w.date, w.time].filter(Boolean).join(" · ")}</p>
                <div className="mx-auto max-w-sm [&_p]:justify-center">
                  <EventDetails event={e} wedding={wedding} />
                </div>
                <span aria-hidden className="mx-auto block h-px w-10 bg-line" />
              </li>
            );
          })}
        </ol>
      );
    default:
      return (
        <ol className={cn("mx-auto space-y-5", t.width)}>
          {events.map((e) => {
            const w = when(e);
            return (
              <li key={e.id} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-left sm:p-7">
                <HostNote text={hostNote(e)} />
                <div>
                  <h2 className={t.itemHeading}>{e.name}</h2>
                  <p className="mt-1 text-sm font-medium text-accent">{[w.date, w.time].filter(Boolean).join(" · ")}</p>
                </div>
                <EventDetails event={e} wedding={wedding} />
              </li>
            );
          })}
        </ol>
      );
  }
}

function IdentifyPrompt({ siteBase, next, style, text }: { siteBase: string; next: string; style: SiteStyleSpec; text: string }) {
  const t = typography(style);
  return (
    <div className={cn("mx-auto rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-6 text-center", t.width)}>
      <p className="text-sm text-ink-muted">{text}</p>
      <Link
        href={`${sitePath(siteBase, "find")}?next=${encodeURIComponent(next)}`}
        className="mt-3 inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        Find your invitation
      </Link>
    </div>
  );
}

// ------------------------------------------------------------ story / party / faq

function Story({
  items,
  photos,
  style,
}: {
  items: Item[];
  photos: Map<string, SitePhoto>;
  style: SiteStyleSpec;
}) {
  const t = typography(style);
  let nextPhotoIndex = 0;
  const entries = items.map((item) => {
    const photo = photos.get(item.id);
    return { item, photo, photoIndex: photo ? nextPhotoIndex++ : -1 };
  });
  const hasPhotos = nextPhotoIndex > 0;

  const copy = (item: Item) => (
    <>
      <h2 className={t.itemHeading}>{item.title}</h2>
      {item.body && (
        <div className="mt-3 text-base leading-relaxed text-ink-muted">
          <TextBlock text={item.body} />
        </div>
      )}
    </>
  );

  if (style.id === "modern") {
    return (
      <div className={cn("mx-auto divide-y divide-line", t.width)}>
        {entries.map(({ item, photo }) => (
          <article
            key={item.id}
            className={cn(
              "py-8 text-left first:pt-0 last:pb-0",
              photo && "md:grid md:grid-cols-[minmax(0,18rem)_1fr] md:items-start md:gap-10",
            )}
          >
            {photo && (
              <div className="mb-4 aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken md:mb-0">
                <SitePhotoImg photo={photo} alt={photo.alt?.trim() ?? ""} />
              </div>
            )}
            <div className="min-w-0">{copy(item)}</div>
          </article>
        ))}
      </div>
    );
  }

  if (style.id === "editorial") {
    return (
      <div className={cn("mx-auto", t.width)}>
        {entries.map(({ item, photo }) => (
          <article key={item.id} className="border-t border-ink py-8 text-left last:pb-0">
            {photo && (
              <div className="mb-5 aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-sunken sm:aspect-[3/2]">
                <SitePhotoImg photo={photo} alt={photo.alt?.trim() ?? ""} />
              </div>
            )}
            {copy(item)}
          </article>
        ))}
      </div>
    );
  }

  if (style.id === "minimal") {
    return (
      <div className={cn("mx-auto divide-y divide-line", t.width)}>
        {entries.map(({ item, photo }) => (
          <article key={item.id} className="py-8 text-center first:pt-0 last:pb-0">
            {photo && (
              <div className="mx-auto mb-6 aspect-[4/3] w-full max-w-md overflow-hidden rounded-none border border-line bg-sunken">
                <SitePhotoImg photo={photo} alt={photo.alt?.trim() ?? ""} />
              </div>
            )}
            {copy(item)}
          </article>
        ))}
      </div>
    );
  }

  // Classic (bordered cards) & Garden (soft panels): widen to max-w-3xl when
  // photos are present and alternate image left/right by photo index.
  const isClassic = style.id === "classic";
  return (
    <div className={cn("mx-auto space-y-5", hasPhotos ? "max-w-3xl" : t.width)}>
      {entries.map(({ item, photo, photoIndex }) => {
        const flip = photoIndex % 2 === 1;
        return (
          <article
            key={item.id}
            className={cn(
              "rounded-[var(--radius-card)] bg-surface p-6 sm:p-8",
              isClassic && "border border-line",
              photo
                ? cn(
                    "md:grid md:grid-cols-2 md:items-center md:gap-8",
                    isClassic ? "text-left" : "text-center md:text-left",
                  )
                : t.align,
            )}
          >
            {photo ? (
              <>
                <div
                  className={cn(
                    "mb-5 aspect-[4/3] overflow-hidden rounded-[var(--radius-control)] bg-sunken md:mb-0",
                    isClassic && "border border-line",
                    flip && "md:order-2",
                  )}
                >
                  <SitePhotoImg photo={photo} alt={photo.alt?.trim() ?? ""} />
                </div>
                <div className={cn("min-w-0", flip && "md:order-1")}>{copy(item)}</div>
              </>
            ) : (
              <div className={cn(hasPhotos && "mx-auto max-w-2xl")}>{copy(item)}</div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Party({
  items,
  photos,
  style,
}: {
  items: Item[];
  photos: Map<string, SitePhoto>;
  style: SiteStyleSpec;
}) {
  const t = typography(style);
  const person = (item: Item) => (
    <>
      <h2 className={t.itemHeading}>{item.title}</h2>
      {item.subtitle && <p className={cn("mt-1", eyebrow)}>{item.subtitle}</p>}
      {item.body && (
        <div className="mt-3 text-sm leading-relaxed text-ink-muted">
          <TextBlock text={item.body} />
        </div>
      )}
    </>
  );
  const portraitFocus = (photo: SitePhoto) => photo.focus || DEFAULT_FOCUS.portrait;

  switch (style.layout.party) {
    case "rule-grid":
      return (
        <ul className={cn("mx-auto grid gap-x-10 sm:grid-cols-2", t.width)}>
          {items.map((i) => {
            const photo = photos.get(i.id);
            return (
              <li key={i.id} className="border-t border-line py-6">
                {photo ? (
                  <div className="flex items-start gap-4">
                    <div className="size-20 shrink-0 overflow-hidden rounded-[var(--radius-control)] border border-line bg-sunken">
                      <SitePhotoImg
                        photo={photo}
                        alt={photo.alt?.trim() ?? ""}
                        focusOverride={portraitFocus(photo)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">{person(i)}</div>
                  </div>
                ) : (
                  person(i)
                )}
              </li>
            );
          })}
        </ul>
      );
    case "soft-grid":
      return (
        <ul className={cn("mx-auto grid gap-4 sm:grid-cols-2", t.width)}>
          {items.map((i) => {
            const photo = photos.get(i.id);
            return (
              <li key={i.id} className="rounded-[var(--radius-card)] bg-surface p-7 text-center">
                {photo && (
                  <div className="mx-auto mb-4 size-24 overflow-hidden rounded-full border-2 border-canvas bg-sunken ring-1 ring-line-strong sm:size-28">
                    <SitePhotoImg
                      photo={photo}
                      alt={photo.alt?.trim() ?? ""}
                      focusOverride={portraitFocus(photo)}
                    />
                  </div>
                )}
                {person(i)}
              </li>
            );
          })}
        </ul>
      );
    case "editorial-list":
      return (
        <ul className={cn("mx-auto", t.width)}>
          {items.map((i) => {
            const photo = photos.get(i.id);
            return (
              <li key={i.id} className="border-t border-ink py-7">
                {photo ? (
                  <div className="flex items-start gap-4 sm:gap-7">
                    <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-sunken sm:w-28">
                      <SitePhotoImg
                        photo={photo}
                        alt={photo.alt?.trim() ?? ""}
                        focusOverride={portraitFocus(photo)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">{person(i)}</div>
                  </div>
                ) : (
                  person(i)
                )}
              </li>
            );
          })}
        </ul>
      );
    case "centered-list":
      return (
        <ul className={cn("mx-auto space-y-10 text-center", t.width)}>
          {items.map((i) => {
            const photo = photos.get(i.id);
            return (
              <li key={i.id}>
                {photo && (
                  <div className="mx-auto mb-4 size-20 overflow-hidden rounded-none border border-line bg-sunken">
                    <SitePhotoImg
                      photo={photo}
                      alt={photo.alt?.trim() ?? ""}
                      focusOverride={portraitFocus(photo)}
                    />
                  </div>
                )}
                {person(i)}
              </li>
            );
          })}
        </ul>
      );
    default:
      return (
        <ul className={cn("mx-auto grid gap-4 sm:grid-cols-2", t.width)}>
          {items.map((i) => {
            const photo = photos.get(i.id);
            return (
              <li
                key={i.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-left"
              >
                {photo ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="aspect-square size-20 shrink-0 overflow-hidden rounded-full bg-sunken ring-1 ring-line ring-offset-2 ring-offset-surface sm:size-24">
                        <SitePhotoImg
                          photo={photo}
                          alt={photo.alt?.trim() ?? ""}
                          focusOverride={portraitFocus(photo)}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className={t.itemHeading}>{i.title}</h2>
                        {i.subtitle && <p className={cn("mt-1", eyebrow)}>{i.subtitle}</p>}
                      </div>
                    </div>
                    {i.body && (
                      <div className="mt-4 text-sm leading-relaxed text-ink-muted">
                        <TextBlock text={i.body} />
                      </div>
                    )}
                  </>
                ) : (
                  person(i)
                )}
              </li>
            );
          })}
        </ul>
      );
  }
}

function Faq({ items, style }: { items: Item[]; style: SiteStyleSpec }) {
  const t = typography(style);
  const layout = style.layout.faq;
  if (layout === "open-list" || layout === "open-centered") {
    return (
      <dl className={cn("mx-auto space-y-8", t.width, layout === "open-centered" && "text-center")}>
        {items.map((i) => (
          <div key={i.id} className={layout === "open-list" ? "border-t border-ink pt-6" : ""}>
            <dt className={t.itemHeading}>{i.title}</dt>
            {i.body && (
              <dd className="mt-2 text-base leading-relaxed text-ink-muted">
                <TextBlock text={i.body} />
              </dd>
            )}
          </div>
        ))}
      </dl>
    );
  }
  const wrapper = {
    accordion: "divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface",
    "accordion-rules": "divide-y divide-line border-y border-line",
    "soft-accordion": "space-y-3",
  }[layout];
  const row = {
    accordion: "px-6 py-4",
    "accordion-rules": "py-4",
    "soft-accordion": "rounded-[var(--radius-card)] bg-surface px-6 py-4",
  }[layout];
  return (
    <div className={cn("mx-auto text-left", t.width, wrapper)}>
      {items.map((i) => (
        <details key={i.id} className={cn("group", row)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-1 text-base font-medium text-ink select-none [&::-webkit-details-marker]:hidden">
            <span>{i.title}</span>
            <span aria-hidden className="shrink-0 text-lg leading-none text-accent transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          {i.body && (
            <div className="pt-2 pb-1 text-sm leading-relaxed text-ink-muted">
              <TextBlock text={i.body} />
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
