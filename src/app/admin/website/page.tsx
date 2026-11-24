import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { deletePageAction, reorderPageAction } from "@/app/admin/website/actions";
import { AddPagePanel } from "@/components/admin/website/add-page-panel";
import {
  Badge,
  buttonClass,
  Card,
  CardHeader,
  ConfirmButton,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  ReorderButtons,
  SubNav,
} from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { addablePageTypes, PAGE_TYPE_META, pageUrl, VISIBILITY_META } from "@/lib/pages";
import { sitePath } from "@/lib/site-paths";

const WEBSITE_SUBNAV = [
  { href: "/admin/website", label: "Pages" },
  { href: "/admin/settings/design", label: "Design" },
];

export default async function WebsitePagesPage() {
  const { wedding, siteBase } = await requireHost();

  const pages = await db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.weddingId, wedding.id))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt));

  const addable = addablePageTypes(pages);
  const needsPasswordWarning =
    !wedding.sitePassword && pages.some((p) => p.visibility === "password");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website"
        description="Choose which pages appear on your wedding website, their order, and who can see them."
        actions={
          <a
            href={sitePath(siteBase)}
            target="_blank"
            rel="noreferrer"
            className={buttonClass("secondary", "sm")}
          >
            View site ↗
          </a>
        }
      />

      <SubNav items={WEBSITE_SUBNAV} current="/admin/website" />

      {needsPasswordWarning && (
        <Notice tone="warn" title="No site password set">
          At least one page is set to &ldquo;Password&rdquo;, but you haven&rsquo;t set a site
          password yet. Until you do, only guests who find their invitation can open it. Add one in{" "}
          <Link href="/admin/settings/site-access" className="font-medium underline">
            Settings → Site access
          </Link>
          .
        </Notice>
      )}

      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          body="Guests see nothing on your website until you add pages. Pick a page below to start building your site."
        />
      ) : (
        <Card>
          <CardHeader
            title="Your pages"
            description="Pages appear in your website navigation in this order."
          />
          <ul className="divide-y divide-line">
            {pages.map((page, i) => {
              const meta = PAGE_TYPE_META[page.type];
              const vis = VISIBILITY_META[page.visibility];
              const href = pageUrl(siteBase, page.slug);
              return (
                <li
                  key={page.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/website/${page.id}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {page.title}
                      </Link>
                      <Badge tone={vis.tone}>{vis.label}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {meta.label} ·{" "}
                      <span className="font-mono text-ink-faint">{href}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <ReorderButtons
                      id={page.id}
                      action={reorderPageAction}
                      isFirst={i === 0}
                      isLast={i === pages.length - 1}
                      label={page.title}
                    />
                    <LinkButton href={`/admin/website/${page.id}`} variant="secondary" size="sm">
                      Edit
                    </LinkButton>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass("ghost", "sm")}
                    >
                      View ↗
                    </a>
                    <form action={deletePageAction}>
                      <input type="hidden" name="id" value={page.id} />
                      <ConfirmButton
                        confirm={`Delete "${page.title}"?${
                          meta.hasItems ? " All entries on this page will be deleted too." : ""
                        }`}
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <AddPagePanel addable={addable} />
    </div>
  );
}
