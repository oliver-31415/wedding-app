import { PageHeader, SubNav } from "@/components/ui";

export const SETTINGS_TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/design", label: "Design" },
  { href: "/admin/settings/site-access", label: "Site access" },
  { href: "/admin/settings/hosts", label: "Hosts" },
];

export function SettingsHeader({ current }: { current: string }) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your wedding details, how your website looks, who can see it, and who helps you run it."
      />
      <SubNav items={SETTINGS_TABS} current={current} />
    </>
  );
}
