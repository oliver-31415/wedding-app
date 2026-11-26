import { SubNav } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { countPendingNameChecks, NAME_CHECKS_PATH } from "@/lib/name-checks";

export const RSVP_NAV_ITEMS = [
  { href: "/admin/rsvp", label: "Responses" },
  { href: "/admin/rsvp/questions", label: "Questions" },
  { href: "/admin/rsvp/dietary", label: "Dietary" },
  { href: NAME_CHECKS_PATH, label: "Name checks" },
  { href: "/admin/rsvp/settings", label: "Settings" },
  { href: "/admin/rsvp/activity", label: "Activity" },
];

/** Shows how many names are waiting to be checked, e.g. "Name checks (2)". */
export async function RsvpSubNav({ current }: { current: string }) {
  const { wedding } = await requireHost();
  const pending = await countPendingNameChecks(wedding.id);
  const items = RSVP_NAV_ITEMS.map((item) =>
    item.href === NAME_CHECKS_PATH && pending > 0 ? { ...item, label: `${item.label} (${pending})` } : item,
  );
  return <SubNav items={items} current={current} />;
}
