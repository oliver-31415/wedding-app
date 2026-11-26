import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextBlock } from "@/components/ui";
import { db, schema } from "@/db";
import { formatDateLong } from "@/lib/dates";
import { buildGoogleMapsUrl } from "@/lib/pages";
import { formatClock } from "@/lib/planning";
import { firstName, formatJobTime, groupHelperJobs, helperLabel, helpersByJob } from "@/lib/run-sheet";
import { loadRunSheet, resolveHelperLink } from "@/lib/run-sheet-data";
import { buildSiteStyleVars, resolveSiteStyle } from "@/lib/site-styles";

export const metadata: Metadata = { title: "Your jobs on the day", robots: { index: false, follow: false } };

/**
 * A helper's own page (/helper/{token}): their jobs, grouped by Day of run
 * sheet item in run sheet order. The
 * link is the permission, so it works whether or not the site is published.
 * Shows only what the couple entered for this helper's jobs, and other
 * helpers' names and roles (never their contact details).
 */
export default async function HelperPage({ params }: PageProps<"/helper/[token]">) {
  const { token } = await params;
  const link = await resolveHelperLink(token);
  if (!link) notFound();
  const { helper, wedding } = link;

  const [{ items, jobs, helpers, assignments }, [venue]] = await Promise.all([
    loadRunSheet(wedding.id),
    // The venue, if the schedule gives one: the first event on the wedding day that names a venue.
    db
      .select({ name: schema.events.venueName, address: schema.events.address, startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(eq(schema.events.weddingId, wedding.id))
      .orderBy(asc(schema.events.position), asc(schema.events.createdAt))
      .then((rows) => rows.filter((e) => e.name && wedding.date && e.startsAt?.startsWith(wedding.date))),
  ]);
  const groups = groupHelperJobs(helper.id, items, jobs, assignments);
  const onJob = helpersByJob(assignments);
  // Names and roles only.
  const people = new Map(helpers.map((h) => [h.id, { name: h.name, role: h.role }]));
  const others = (jobId: string) =>
    (onJob.get(jobId) ?? [])
      .filter((id) => id !== helper.id)
      .map((id) => people.get(id))
      .filter((p) => !!p)
      .map(helperLabel);

  const resolved = resolveSiteStyle({ savedTheme: wedding.theme, savedAccent: wedding.accentColor, isHost: false });
  const { style } = resolved;
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const jobCount = groups.reduce((n, g) => n + g.jobs.length, 0);

  return (
    <div
      data-site-style="true"
      data-style={style.id}
      data-content={style.layout.content}
      data-radius={style.layout.radius}
      style={buildSiteStyleVars(resolved)}
      className="min-h-dvh"
    >
      <main className="mx-auto w-full max-w-xl space-y-8 px-4 pt-10 pb-16 sm:pt-16">
        <header className="space-y-3 text-center">
          <p className="font-serif text-3xl font-medium text-ink sm:text-4xl">{couple}</p>
          {wedding.date && <p className="text-sm tracking-wide text-ink-muted">{formatDateLong(wedding.date)}</p>}
          {venue ? (
            <p className="text-sm text-ink-muted">
              {venue.name}
              {venue.address && (
                <>
                  {" · "}
                  <a
                    href={buildGoogleMapsUrl(venue.name, venue.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent-strong underline underline-offset-2"
                  >
                    Map
                  </a>
                </>
              )}
            </p>
          ) : (
            wedding.locationName && <p className="text-sm text-ink-muted">{wedding.locationName}</p>
          )}
          <div className="mx-auto h-px w-14 bg-accent" aria-hidden="true" />
        </header>

        <section className="space-y-2">
          <h1 className="font-serif text-2xl text-ink">Hi {firstName(helper.name)}</h1>
          <p className="leading-relaxed text-ink-muted">
            {jobCount === 0
              ? "You're not on any jobs yet. Check back closer to the day."
              : `Thank you for helping! Here ${jobCount === 1 ? "is the job" : `are the ${jobCount} jobs`} you're doing${helper.role ? ` as ${helper.role}` : ""}. This page stays up to date if plans change.`}
          </p>
        </section>

        {groups.map(({ item, jobs: theirs }) => (
          <section
            key={item.id}
            aria-labelledby={`item-${item.id}`}
            className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface"
          >
            <div className="space-y-1 border-b border-line px-4 py-4 sm:px-5">
              {item.time && <p className="text-sm font-medium text-ink-muted tabular-nums">{formatClock(item.time)}</p>}
              <h2 id={`item-${item.id}`} className="font-serif text-xl text-ink">
                {item.title}
              </h2>
              {item.location && <p className="text-sm text-ink">{item.location}</p>}
              <TextBlock text={item.notes} className="space-y-2 text-sm leading-relaxed text-ink-muted" />
            </div>
            <ol className="divide-y divide-line">
              {theirs.map((job) => {
                const timeText = formatJobTime(job);
                const with_ = others(job.id);
                return (
                  <li key={job.id} className="space-y-1.5 px-4 py-4 sm:px-5">
                    {timeText && <p className="text-sm font-semibold text-accent-strong tabular-nums">{timeText}</p>}
                    <p className="text-lg leading-snug font-medium text-ink">{job.title}</p>
                    <TextBlock text={job.notes} className="space-y-2 text-sm leading-relaxed text-ink-muted" />
                    {with_.length > 0 && <p className="text-sm text-ink-muted">With {joinNames(with_)}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        <p className="text-center text-xs text-ink-faint">
          This page is just for you, from {couple}. Keep the link handy on the day.
        </p>
      </main>
    </div>
  );
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
