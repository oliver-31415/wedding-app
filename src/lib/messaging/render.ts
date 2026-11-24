import { formatDateLong } from "@/lib/dates";
import { appUrl, renderEmail } from "@/lib/email-layout";
import { sitePath, slugBase } from "@/lib/site-paths";
import { DEFAULT_BUTTON_LABELS, type ButtonTarget } from "./templates";

export type RenderWedding = {
  slug: string;
  /** Guest-site base when it isn't /w/{slug}: "" for a wedding served at the root. */
  siteBase?: string;
  partnerOne: string;
  partnerTwo: string;
  date: string | null;
  accentColor?: string | null;
};

export type RenderMessageContent = {
  subject: string;
  body: string;
  buttonTarget: ButtonTarget | null;
  buttonLabel: string | null;
};

export type RenderRecipient = {
  firstName: string;
};

export type RenderMessageInput = {
  wedding: RenderWedding;
  message: RenderMessageContent;
  recipient: RenderRecipient;
  inviteToken?: string | null;
  /** Override base URL (useful when rendering live previews in the browser). */
  baseUrl?: string;
};

export type RenderedMessage = {
  subject: string;
  html: string;
  text: string;
};

function substituteTokens(
  input: string,
  tokens: { first_name: string; partner_one: string; partner_two: string },
): string {
  return input.replace(
    /\{(first_name|partner_one|partner_two)\}/g,
    (_, key: keyof typeof tokens) => tokens[key],
  );
}

export function resolveButtonUrl(
  target: ButtonTarget,
  wedding: Pick<RenderWedding, "slug" | "siteBase">,
  inviteToken: string | null | undefined,
  baseUrl?: string,
): string {
  const origin = (baseUrl ?? appUrl()).replace(/\/$/, "");
  const site = wedding.siteBase ?? slugBase(encodeURIComponent(wedding.slug));
  switch (target) {
    case "site":
      return `${origin}${sitePath(site)}`;
    case "rsvp":
      return `${origin}${sitePath(site, inviteToken ? `i/${encodeURIComponent(inviteToken)}` : "rsvp")}`;
    case "gifts":
      return `${origin}${sitePath(site, "gifts")}`;
  }
}

/**
 * Renders a message for one guest recipient through the shared email layout.
 * All dynamic content is escaped inside `renderEmail`.
 */
export function renderMessage({
  wedding,
  message,
  recipient,
  inviteToken,
  baseUrl,
}: RenderMessageInput): RenderedMessage {
  const tokens = {
    first_name: recipient.firstName,
    partner_one: wedding.partnerOne,
    partner_two: wedding.partnerTwo,
  };

  const subject = substituteTokens(message.subject, tokens)
    .replace(/[\r\n]+/g, " ")
    .trim();
  const body = substituteTokens(message.body, tokens);

  const heading = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  const footer = wedding.date
    ? `${heading} · ${formatDateLong(wedding.date)}`
    : heading;

  let button: { label: string; url: string } | null = null;
  if (message.buttonTarget) {
    const rawLabel =
      message.buttonLabel?.trim() || DEFAULT_BUTTON_LABELS[message.buttonTarget];
    button = {
      label: substituteTokens(rawLabel, tokens),
      url: resolveButtonUrl(message.buttonTarget, wedding, inviteToken, baseUrl),
    };
  }

  const { html, text } = renderEmail({
    heading,
    body,
    button,
    footer,
    accentColor: wedding.accentColor ?? undefined,
  });

  return { subject, html, text };
}
