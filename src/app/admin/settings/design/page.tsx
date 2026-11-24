import type { Metadata } from "next";
import { DesignSettings } from "@/components/admin/settings/design-settings";
import { SettingsHeader } from "@/components/admin/settings/settings-header";
import { requireHost } from "@/lib/auth";
import { getSiteStyle, normalizeHexColor } from "@/lib/site-styles";
import { saveDesignAction } from "./actions";

export const metadata: Metadata = { title: "Design" };

export default async function DesignSettingsPage() {
  const { wedding, siteBase } = await requireHost();
  const style = getSiteStyle(wedding.theme);
  return (
    <div>
      <SettingsHeader current="/admin/settings/design" />
      <DesignSettings
        siteBase={siteBase}
        savedStyle={style.id}
        savedAccent={normalizeHexColor(wedding.accentColor) ?? style.defaultAccent}
        action={saveDesignAction}
      />
    </div>
  );
}
