import { daysUntil, formatDateLong } from "@/lib/dates";

export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export function formatWeddingDateHeader(
  date: string | null,
  timeZone: string,
  now = Date.now(),
): string | null {
  if (!date) return null;
  const formatted = formatDateLong(date);
  const days = daysUntil(date, timeZone, now);
  if (days > 1) return `${days} days to go · ${formatted}`;
  if (days === 1) return `1 day to go · ${formatted}`;
  if (days === 0) return `Today · ${formatted}`;
  return formatted;
}

export type SetupChecklistItem = {
  id: "pages" | "events" | "guests" | "rsvp_deadline" | "publish";
  label: string;
  description: string;
  href: string;
};

export type SetupChecklistResult = {
  unfinished: SetupChecklistItem[];
  completedCount: number;
  totalCount: number;
};

export function getSetupChecklist(input: {
  hasPages: boolean;
  hasEvents: boolean;
  hasGuests: boolean;
  hasRsvpDeadline: boolean;
  isPublished: boolean;
}): SetupChecklistResult {
  const all: (SetupChecklistItem & { done: boolean })[] = [
    {
      id: "pages",
      label: "Add your first page",
      description: "Choose which pages appear on your wedding website.",
      href: "/admin/website",
      done: input.hasPages,
    },
    {
      id: "events",
      label: "Add events to the schedule",
      description: "Set up your ceremony, reception or other wedding events.",
      href: "/admin/schedule",
      done: input.hasEvents,
    },
    {
      id: "guests",
      label: "Add guests",
      description: "Build your guest list and organise households.",
      href: "/admin/guests",
      done: input.hasGuests,
    },
    {
      id: "rsvp_deadline",
      label: "Set an RSVP deadline",
      description: "Let guests know when you need their reply by.",
      href: "/admin/rsvp/settings",
      done: input.hasRsvpDeadline,
    },
    {
      id: "publish",
      label: "Publish your site",
      description: "Make your wedding website visible to guests.",
      href: "/admin/settings/site-access",
      done: input.isPublished,
    },
  ];

  const unfinished = all
    .filter((item) => !item.done)
    .map(({ id, label, description, href }) => ({ id, label, description, href }));

  return {
    unfinished,
    completedCount: all.length - unfinished.length,
    totalCount: all.length,
  };
}

export function formatActivityAction(source: "guest" | "host", kind: "first" | "update"): string {
  if (source === "host") return "RSVP edited by you";
  return kind === "first" ? "replied" : "updated their RSVP";
}

export function excerptNote(note: string | null, maxLength = 140): string | null {
  if (!note) return null;
  const collapsed = note.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}
