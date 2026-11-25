"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/checklist", label: "Checklist" },
  { href: "/admin/budget", label: "Budget & vendors" },
  { href: "/admin/guests", label: "Guests" },
  { href: "/admin/rsvp", label: "RSVPs" },
  { href: "/admin/seating", label: "Seating" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/day-of", label: "Day of" },
  { href: "/admin/website", label: "Website" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/gifts", label: "Gift list" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] md:mx-0 md:flex-col md:overflow-visible md:px-0 md:[mask-image:none]">
      {ADMIN_NAV.map((item) => {
        const active = "exact" in item ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm whitespace-nowrap",
              active ? "bg-brand-soft font-medium text-brand-strong" : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
