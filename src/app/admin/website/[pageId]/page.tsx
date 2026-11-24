import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePageAction } from "@/app/admin/website/actions";
import { PageItemsEditor } from "@/components/admin/website/page-items-editor";
import { PageSettingsForm } from "@/components/admin/website/page-settings-form";
import { BackLink, Badge, buttonClass, Card, CardBody, CardHeader, ConfirmButton, LinkButton, Notice, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { PAGE_TYPE_META, pageUrl, VISIBILITY_META } from "@/lib/pages";

export default async function WebsitePageEditor({
  params,
}: PageProps<"/admin/website/[pageId]">) {
  const { wedding } = await requireHost();
  const { pageId } = await params;

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.id, pageId), eq(schema.pages.weddingId, wedding.id)))
    .limit(1);

  if (!page) notFound();

  const meta = PAGE_TYPE_META[page.type];
  const vis = VISIBILITY_META[page.visibility];
  const previewHref = pageUrl(wedding.slug, page.slug);

  const [tags, items, eventCount] = await Promise.all([
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
    meta.hasItems
      ? db
          .select({
            id: schema.pageItems.id,
            title: schema.pageItems.title,
            subtitle: schema.pageItems.subtitle,
            body: schema.pageItems.body,
            position: schema.pageItems.position,
          })
          .from(schema.pageItems)
          .where(
            and(eq(schema.pageItems.pageId, page.id), eq(schema.pageItems.weddingId, wedding.id)),
          )
          .orderBy(asc(schema.pageItems.position), asc(schema.pageItems.createdAt))
      : Promise.resolve([]),
    page.type === "schedule"
      ? db
          .select({ id: schema.events.id })
          .from(schema.events)
          .where(eq(schema.events.weddingId, wedding.id))
          .then((rows) => rows.length)
      : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <BackLink href="/admin/website">Pages</BackLink>
        }
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span>{page.title}</span>
            <Badge tone={vis.tone}>{vis.label}</Badge>
          </span>
        }
        description={meta.label}
        actions={
          <>
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("secondary", "sm")}
            >
              Preview ↗
            </a>
            <form action={deletePageAction}>
              <input type="hidden" name="id" value={page.id} />
              <input type="hidden" name="redirectTo" value="list" />
              <ConfirmButton
                confirm={`Delete "${page.title}"?${
                  meta.hasItems ? " All entries on this page will be deleted too." : ""
                }`}
              >
                Delete page
              </ConfirmButton>
            </form>
          </>
        }
      />

      {page.visibility === "password" && !wedding.sitePassword && (
        <Notice tone="warn" title="No site password set">
          This page needs a password, but your site doesn&rsquo;t have one yet — until you set one, only guests
          who find their invitation can open it. Set it in{" "}
          <Link href="/admin/settings/site-access" className="font-medium underline">
            Settings → Site access
          </Link>
          .
        </Notice>
      )}

      <Card>
        <CardHeader
          title="Page details"
          description={
            page.type === "home"
              ? "Edit the title, visibility and welcome message for your front page."
              : "Edit the page title, who can view it, and optional intro text."
          }
        />
        <CardBody>
          <PageSettingsForm
            page={{
              id: page.id,
              type: page.type,
              title: page.title,
              slug: page.slug,
              body: page.body,
              visibility: page.visibility,
              audience: page.audience,
            }}
            weddingSlug={wedding.slug}
            tags={tags}
          />
        </CardBody>
      </Card>

      {page.type === "home" && (
        <Card>
          <CardHeader
            title="Header details"
            description="Your names, date and location are shared across your whole site and only appear if set."
            actions={
              <LinkButton href="/admin/settings" variant="secondary" size="sm">
                Edit in Settings
              </LinkButton>
            }
          />
          <CardBody>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted">Couple names</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {wedding.partnerOne} &amp; {wedding.partnerTwo}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Date</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {wedding.date ? formatDateLong(wedding.date) : <span className="text-ink-faint">Not set (hidden)</span>}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Location</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {wedding.locationName ?? <span className="text-ink-faint">Not set (hidden)</span>}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      )}

      {page.type === "schedule" && (
        <Card>
          <CardHeader
            title="Events"
            description={
              eventCount === 0
                ? "You haven’t added any events yet. Events added in Schedule appear automatically on this page."
                : `${eventCount} ${eventCount === 1 ? "event" : "events"} in your schedule. Events are managed in the Schedule section.`
            }
            actions={
              <LinkButton href="/admin/schedule" variant="secondary" size="sm">
                Manage schedule
              </LinkButton>
            }
          />
        </Card>
      )}

      {page.type === "gifts" && (
        <Card>
          <CardHeader
            title="Gift items and cash funds"
            description="Add and organise your gift items and cash funds in the Gift list section."
            actions={
              <LinkButton href="/admin/gifts" variant="secondary" size="sm">
                Manage gift list
              </LinkButton>
            }
          />
        </Card>
      )}

      {page.type === "rsvp" && (
        <Card>
          <CardHeader
            title="RSVP questions and settings"
            description="Configure your RSVP deadline, questions and responses in the RSVPs section."
            actions={
              <LinkButton href="/admin/rsvp" variant="secondary" size="sm">
                Manage RSVPs
              </LinkButton>
            }
          />
        </Card>
      )}

      {(page.type === "story" || page.type === "party" || page.type === "faq") && (
        <PageItemsEditor pageId={page.id} pageType={page.type} items={items} />
      )}
    </div>
  );
}
