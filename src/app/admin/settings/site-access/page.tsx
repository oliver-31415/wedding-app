import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getPublishWarnings } from "@/components/admin/settings/helpers";
import { SettingsHeader } from "@/components/admin/settings/settings-header";
import { PublishCard, SearchVisibilityCard, SitePasswordCard } from "@/components/admin/settings/site-access-forms";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { appUrl } from "@/lib/email-layout";
import {
  removeSitePasswordAction,
  saveSearchVisibilityAction,
  saveSitePasswordAction,
  togglePublishAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Site access settings",
};

export default async function SiteAccessSettingsPage() {
  const { wedding } = await requireHost();

  const [weddingPages, weddingEvents] = await Promise.all([
    db
      .select({ type: schema.pages.type })
      .from(schema.pages)
      .where(eq(schema.pages.weddingId, wedding.id)),
    db
      .select({ rsvpEnabled: schema.events.rsvpEnabled })
      .from(schema.events)
      .where(eq(schema.events.weddingId, wedding.id)),
  ]);

  const warnings = getPublishWarnings({
    pageTypes: weddingPages.map((p) => p.type),
    rsvpEventCount: weddingEvents.filter((e) => e.rsvpEnabled).length,
  });

  const siteUrl = `${appUrl()}/w/${wedding.slug}`;

  return (
    <div>
      <SettingsHeader current="/admin/settings/site-access" />
      <div className="space-y-6">
        <PublishCard
          published={wedding.published}
          siteUrl={siteUrl}
          warnings={warnings}
          action={togglePublishAction}
        />
        <SitePasswordCard
          sitePassword={wedding.sitePassword}
          saveAction={saveSitePasswordAction}
          removeAction={removeSitePasswordAction}
        />
        <SearchVisibilityCard
          searchVisible={wedding.searchVisible}
          action={saveSearchVisibilityAction}
        />
      </div>
    </div>
  );
}
