import type { Metadata } from "next";
import { GeneralDetailsForm, WebAddressCard } from "@/components/admin/settings/general-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-header";
import { requireHost } from "@/lib/auth";
import { toPublicWedding } from "@/lib/public-wedding";
import { appUrl } from "@/lib/email-layout";
import { updateGeneralAction, updateSlugAction } from "./actions";

export const metadata: Metadata = {
  title: "General settings",
};

export default async function GeneralSettingsPage() {
  const { wedding, role } = await requireHost();

  return (
    <div>
      <SettingsHeader current="/admin/settings" />
      <div className="space-y-6">
        <GeneralDetailsForm wedding={toPublicWedding(wedding)} action={updateGeneralAction} />
        <WebAddressCard
          slug={wedding.slug}
          siteBaseUrl={appUrl()}
          isOwner={role === "owner"}
          action={updateSlugAction}
        />
      </div>
    </div>
  );
}
