import type { MessageKind, MessageRecipients } from "@/db/schema";
import { EVERYONE } from "@/lib/audience";
import { formatDateLong } from "@/lib/dates";

export type ButtonTarget = "site" | "rsvp" | "gifts";

export type TemplateWedding = {
  partnerOne: string;
  partnerTwo: string;
  date: string | null;
  locationName: string | null;
  rsvpDeadline: string | null;
};

export type MessageTemplate = {
  kind: MessageKind;
  subject: string;
  body: string;
  buttonTarget: ButtonTarget | null;
  buttonLabel: string | null;
  recipients: MessageRecipients;
};

export const DEFAULT_BUTTON_LABELS: Record<ButtonTarget, string> = {
  site: "Visit our website",
  rsvp: "RSVP",
  gifts: "View gift list",
};

export const MESSAGE_KIND_META: Record<
  MessageKind,
  { label: string; description: string }
> = {
  save_the_date: {
    label: "Save the date",
    description: "Share your date and link guests to your wedding website.",
  },
  invitation: {
    label: "Invitation",
    description: "Invite guests with their personal RSVP link.",
  },
  rsvp_reminder: {
    label: "RSVP reminder",
    description: "Nudge guests who haven't replied yet.",
  },
  custom: {
    label: "Custom message",
    description: "Start from a blank email for any update.",
  },
};

export const MESSAGE_KIND_ORDER: MessageKind[] = [
  "save_the_date",
  "invitation",
  "rsvp_reminder",
  "custom",
];

export function isMessageKind(value: string | null | undefined): value is MessageKind {
  return (
    value === "save_the_date" ||
    value === "invitation" ||
    value === "rsvp_reminder" ||
    value === "custom"
  );
}

/**
 * Builds starting content for a new message draft using ONLY details the
 * couple has actually entered. Missing fields are omitted cleanly rather than
 * filled with placeholders.
 */
export function buildMessageTemplate(
  kind: MessageKind,
  wedding: TemplateWedding,
): MessageTemplate {
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const dateStr = wedding.date ? formatDateLong(wedding.date) : null;
  const location = wedding.locationName?.trim() || null;
  const deadlineStr = wedding.rsvpDeadline ? formatDateLong(wedding.rsvpDeadline) : null;

  switch (kind) {
    case "save_the_date": {
      let intro: string;
      if (dateStr && location) {
        intro = `We're getting married on ${dateStr} in ${location}, and we'd love for you to save the date.`;
      } else if (dateStr) {
        intro = `We're getting married on ${dateStr}, and we'd love for you to save the date.`;
      } else if (location) {
        intro = `We're getting married in ${location}, and we'd love for you to celebrate with us.`;
      } else {
        intro = "We're getting married and we'd love for you to celebrate with us.";
      }

      const body = [
        "Hi {first_name},",
        intro,
        "More details and formal invitations will follow soon — you can keep up to date on our wedding website.",
        `Warmly,\n${couple}`,
      ].join("\n\n");

      return {
        kind,
        subject: `Save the date — ${couple}`,
        body,
        buttonTarget: "site",
        buttonLabel: "Visit our website",
        recipients: { audience: EVERYONE, rsvpStatus: "any" },
      };
    }

    case "invitation": {
      let intro: string;
      if (dateStr && location) {
        intro = `We'd love you to celebrate our wedding with us on ${dateStr} in ${location}.`;
      } else if (dateStr) {
        intro = `We'd love you to celebrate our wedding with us on ${dateStr}.`;
      } else if (location) {
        intro = `We'd love you to celebrate our wedding with us in ${location}.`;
      } else {
        intro = "We'd love you to celebrate our wedding with us.";
      }

      const rsvpLine = deadlineStr
        ? `Please let us know if you can make it by ${deadlineStr} using your personal RSVP link below.`
        : "Please let us know if you can make it using your personal RSVP link below.";

      const body = [
        "Hi {first_name},",
        intro,
        rsvpLine,
        `Warmly,\n${couple}`,
      ].join("\n\n");

      return {
        kind,
        subject: `You're invited — ${couple}`,
        body,
        buttonTarget: "rsvp",
        buttonLabel: "RSVP",
        recipients: { audience: EVERYONE, rsvpStatus: "any" },
      };
    }

    case "rsvp_reminder": {
      const paragraphs = [
        "Hi {first_name},",
        "Just a gentle reminder to let us know if you can join us for our wedding.",
      ];
      if (deadlineStr) {
        paragraphs.push(
          `Please reply by ${deadlineStr} so we can finalise numbers.`,
        );
      }
      paragraphs.push("You can reply quickly using your personal RSVP link below.");
      paragraphs.push(`Warmly,\n${couple}`);

      return {
        kind,
        subject: `Reminder: please RSVP — ${couple}`,
        body: paragraphs.join("\n\n"),
        buttonTarget: "rsvp",
        buttonLabel: "RSVP",
        recipients: { audience: EVERYONE, rsvpStatus: "not_responded" },
      };
    }

    case "custom":
      return {
        kind,
        subject: "",
        body: "",
        buttonTarget: null,
        buttonLabel: null,
        recipients: { audience: EVERYONE, rsvpStatus: "any" },
      };
  }
}
