import type { MessageRecipients } from "@/db/schema";
import { describeAudience } from "@/lib/audience";
import type { ButtonTarget } from "@/lib/messaging/templates";

export const RSVP_STATUS_OPTIONS: {
  value: MessageRecipients["rsvpStatus"];
  label: string;
}[] = [
  { value: "any", label: "Everyone" },
  { value: "not_responded", label: "Awaiting reply" },
  { value: "responded", label: "Replied" },
  { value: "attending", label: "Attending" },
  { value: "declined", label: "Declined" },
];

const RSVP_STATUS_LABELS: Record<MessageRecipients["rsvpStatus"], string> = {
  any: "Everyone",
  not_responded: "Awaiting reply",
  responded: "Replied",
  attending: "Attending",
  declined: "Declined",
};

export function isRsvpStatus(
  value: string | null | undefined,
): value is MessageRecipients["rsvpStatus"] {
  return (
    value === "any" ||
    value === "not_responded" ||
    value === "responded" ||
    value === "attending" ||
    value === "declined"
  );
}

export function rsvpStatusLabel(status: MessageRecipients["rsvpStatus"]): string {
  return RSVP_STATUS_LABELS[status];
}

export const BUTTON_TARGET_OPTIONS: { value: "" | ButtonTarget; label: string }[] = [
  { value: "", label: "None" },
  { value: "site", label: "Wedding website" },
  { value: "rsvp", label: "RSVP (personal link)" },
  { value: "gifts", label: "Gift list" },
];

export function isButtonTarget(
  value: string | null | undefined,
): value is ButtonTarget {
  return value === "site" || value === "rsvp" || value === "gifts";
}

export function buttonTargetLabel(target: ButtonTarget | null): string {
  switch (target) {
    case "site":
      return "Wedding website";
    case "rsvp":
      return "RSVP (personal link)";
    case "gifts":
      return "Gift list";
    default:
      return "None";
  }
}

export function describeRecipients(
  recipients: MessageRecipients,
  tagNames: Map<string, string>,
): string {
  const audiencePart = describeAudience(recipients.audience, tagNames);
  if (recipients.rsvpStatus === "any") return audiencePart;
  return `${audiencePart} · ${rsvpStatusLabel(recipients.rsvpStatus)}`;
}

/** Formats a Date or unix ms instant in the wedding's IANA time zone (en-AU). */
export function formatTimestamp(
  value: Date | number,
  timeZone: string,
): string {
  const date = typeof value === "number" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
