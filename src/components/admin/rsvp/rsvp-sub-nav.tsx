import { SubNav } from "@/components/ui";

export const RSVP_NAV_ITEMS = [
  { href: "/admin/rsvp", label: "Responses" },
  { href: "/admin/rsvp/questions", label: "Questions" },
  { href: "/admin/rsvp/settings", label: "Settings" },
  { href: "/admin/rsvp/activity", label: "Activity" },
];

export function RsvpSubNav({ current }: { current: string }) {
  return <SubNav items={RSVP_NAV_ITEMS} current={current} />;
}
