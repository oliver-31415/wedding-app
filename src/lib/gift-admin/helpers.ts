import { itemProgress } from "@/lib/gifts";
import { formatMoney, parseMoney } from "@/lib/money";

export const MAX_NAME = 100;
export const MAX_STORE = 100;
export const MAX_EMAIL = 200;
export const MAX_URL = 2000;
export const MAX_NOTE = 1000;
export const MAX_DESCRIPTION = 1000;
export const MAX_INSTRUCTIONS = 2000;
export const MAX_MESSAGE = 1000;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;
export const MAX_GIFT_IMAGE_BYTES = 5 * 1024 * 1024;
export const GIFT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates an optional http/https URL. Blank returns null. */
export function validateHttpUrl(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > MAX_URL) {
    return { ok: false, error: `Keep this link under ${MAX_URL} characters.` };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a valid web address starting with http:// or https://." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Link must start with http:// or https://." };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "Enter a valid web address." };
  }
  return { ok: true, value: trimmed };
}

/** Suggests a store name from a pasted http/https URL hostname, e.g. "davidjones.com". */
export function suggestStoreFromUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  return host || null;
}

/** Formats integer cents as a plain numeric string for form inputs ("549" or "549.50"). */
export function centsToInputValue(cents: number | null | undefined): string {
  if (cents == null) return "";
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

/** Status badge per CONVENTIONS.md: claimed in full → "Gifted" (good), partly → "2 of 3 gifted" (info), none → null. */
export function itemStatusBadge(
  progress: { claimed: number; remaining: number; complete: boolean },
  quantityWanted: number,
): { label: string; tone: "good" | "info" } | null {
  if (progress.complete) return { label: "Gifted", tone: "good" };
  if (progress.claimed > 0) return { label: `${progress.claimed} of ${quantityWanted} gifted`, tone: "info" };
  return null;
}

/**
 * Prepares gift items for the guest page: excludes hidden items, preserves host
 * order (`position`), and moves fully gifted items to the end.
 */
export function sortGuestItems<
  TItem extends { id: string; quantityWanted: number; hidden: boolean; position: number; createdAt?: Date },
  TClaim extends { itemId: string; quantity: number; thankedAt: Date | null },
>(items: TItem[], claims: TClaim[]): Array<{ item: TItem; progress: ReturnType<typeof itemProgress> }> {
  const visible = items
    .filter((i) => !i.hidden)
    .sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    });

  const withProgress = visible.map((item) => ({ item, progress: itemProgress(item, claims) }));
  const available = withProgress.filter((entry) => !entry.progress.complete);
  const completed = withProgress.filter((entry) => entry.progress.complete);
  return [...available, ...completed];
}

// ---------------------------------------------------------------- validation

export type GiftItemValidated = {
  name: string;
  url: string | null;
  storeName: string | null;
  priceCents: number | null;
  quantityWanted: number;
  mostWanted: boolean;
  note: string | null;
  hidden: boolean;
};

export function validateGiftItemInput(raw: {
  name: string | null;
  url: string | null;
  storeName: string | null;
  price: string | null;
  quantityWanted: string | null;
  mostWanted: boolean;
  note: string | null;
  hidden: boolean;
}): { ok: true; value: GiftItemValidated } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = raw.name?.trim() ?? "";
  if (!name) errors.name = "Enter an item name.";
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters.`;

  const urlCheck = validateHttpUrl(raw.url);
  if (!urlCheck.ok) errors.url = urlCheck.error;

  const storeName = raw.storeName?.trim() || null;
  if (storeName && storeName.length > MAX_STORE) {
    errors.storeName = `Keep the store name under ${MAX_STORE} characters.`;
  }

  const priceCents = parseMoney(raw.price);
  if (priceCents !== null && Number.isNaN(priceCents)) {
    errors.price = "Enter a valid price, like 120 or 120.50.";
  }

  const qtyRaw = (raw.quantityWanted ?? "").trim();
  const qty = qtyRaw === "" ? 1 : Number(qtyRaw);
  if (!Number.isInteger(qty) || qty < MIN_QUANTITY || qty > MAX_QUANTITY) {
    errors.quantityWanted = `Enter a whole number between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`;
  }

  const note = raw.note?.trim() || null;
  if (note && note.length > MAX_NOTE) {
    errors.note = `Keep your note under ${MAX_NOTE} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      url: urlCheck.ok ? urlCheck.value : null,
      storeName,
      priceCents,
      quantityWanted: qty,
      mostWanted: raw.mostWanted,
      note,
      hidden: raw.hidden,
    },
  };
}

export type CashFundValidated = {
  name: string;
  description: string | null;
  goalCents: number | null;
  paymentInstructions: string | null;
  paymentUrl: string | null;
  hidden: boolean;
};

export function validateCashFundInput(raw: {
  name: string | null;
  description: string | null;
  goal: string | null;
  paymentInstructions: string | null;
  paymentUrl: string | null;
  hidden: boolean;
}): { ok: true; value: CashFundValidated } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = raw.name?.trim() ?? "";
  if (!name) errors.name = "Enter a fund name.";
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters.`;

  const description = raw.description?.trim() || null;
  if (description && description.length > MAX_DESCRIPTION) {
    errors.description = `Keep the description under ${MAX_DESCRIPTION} characters.`;
  }

  const goalCents = parseMoney(raw.goal);
  if (goalCents !== null && (Number.isNaN(goalCents) || goalCents <= 0)) {
    errors.goal = "Enter a valid goal amount greater than 0, or leave it blank.";
  }

  const paymentInstructions = raw.paymentInstructions?.trim() || null;
  if (paymentInstructions && paymentInstructions.length > MAX_INSTRUCTIONS) {
    errors.paymentInstructions = `Keep payment instructions under ${MAX_INSTRUCTIONS} characters.`;
  }

  const urlCheck = validateHttpUrl(raw.paymentUrl);
  if (!urlCheck.ok) errors.paymentUrl = urlCheck.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      description,
      goalCents,
      paymentInstructions,
      paymentUrl: urlCheck.ok ? urlCheck.value : null,
      hidden: raw.hidden,
    },
  };
}

export type OfflineGiftValidated =
  | { kind: "item"; itemId: string; giverName: string; quantity: number; message: string | null }
  | { kind: "fund"; fundId: string; giverName: string; amountCents: number; message: string | null };

export function validateOfflineGiftInput(raw: {
  kind: string | null;
  itemId: string | null;
  fundId: string | null;
  giverName: string | null;
  quantity: string | null;
  amount: string | null;
  message: string | null;
}): { ok: true; value: OfflineGiftValidated } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const kind = raw.kind === "item" ? "item" : raw.kind === "fund" ? "fund" : null;
  if (!kind) errors.kind = "Choose whether this is a gift item or a cash fund.";

  const giverName = raw.giverName?.trim() ?? "";
  if (!giverName) errors.giverName = "Enter the giver's name.";
  else if (giverName.length > MAX_NAME) errors.giverName = `Keep the name under ${MAX_NAME} characters.`;

  const message = raw.message?.trim() || null;
  if (message && message.length > MAX_MESSAGE) {
    errors.message = `Keep the message under ${MAX_MESSAGE} characters.`;
  }

  if (kind === "item") {
    const itemId = raw.itemId?.trim() ?? "";
    if (!itemId) errors.itemId = "Choose a gift item.";
    const qty = Number((raw.quantity ?? "").trim() || "1");
    if (!Number.isInteger(qty) || qty < MIN_QUANTITY || qty > MAX_QUANTITY) {
      errors.quantity = `Enter a whole number between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`;
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, value: { kind: "item", itemId, giverName, quantity: qty, message } };
  }

  if (kind === "fund") {
    const fundId = raw.fundId?.trim() ?? "";
    if (!fundId) errors.fundId = "Choose a cash fund.";
    const amountCents = parseMoney(raw.amount);
    if (amountCents === null || Number.isNaN(amountCents) || amountCents <= 0) {
      errors.amount = "Enter a valid amount greater than 0.";
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, value: { kind: "fund", fundId, giverName, amountCents: amountCents!, message } };
  }

  return { ok: false, errors };
}

export type GuestClaimValidated = {
  giverName: string;
  giverEmail: string | null;
  quantity: number;
  message: string | null;
};

export function validateGuestClaimInput(
  raw: {
    giverName: string | null;
    giverEmail: string | null;
    quantity: string | null;
    message: string | null;
  },
  remaining: number,
): { ok: true; value: GuestClaimValidated } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const giverName = raw.giverName?.trim() ?? "";
  if (!giverName) errors.giverName = "Enter your name.";
  else if (giverName.length > MAX_NAME) errors.giverName = `Keep your name under ${MAX_NAME} characters.`;

  const giverEmail = raw.giverEmail?.trim() || null;
  if (giverEmail) {
    if (giverEmail.length > MAX_EMAIL || !EMAIL_RE.test(giverEmail)) {
      errors.giverEmail = "Enter a valid email address, or leave it blank.";
    }
  }

  const qtyRaw = (raw.quantity ?? "").trim();
  const qty = qtyRaw === "" ? 1 : Number(qtyRaw);
  if (remaining <= 0) {
    errors.quantity = "This gift has already been claimed.";
  } else if (!Number.isInteger(qty) || qty < 1 || qty > remaining) {
    errors.quantity =
      remaining === 1 ? "Only 1 is still wanted." : `Choose a quantity between 1 and ${remaining}.`;
  }

  const message = raw.message?.trim() || null;
  if (message && message.length > MAX_MESSAGE) {
    errors.message = `Keep your message under ${MAX_MESSAGE} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { giverName, giverEmail, quantity: qty, message } };
}

export type GuestPledgeValidated = {
  giverName: string;
  amountCents: number;
  message: string | null;
};

export function validateGuestPledgeInput(raw: {
  giverName: string | null;
  amount: string | null;
  message: string | null;
}): { ok: true; value: GuestPledgeValidated } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const giverName = raw.giverName?.trim() ?? "";
  if (!giverName) errors.giverName = "Enter your name.";
  else if (giverName.length > MAX_NAME) errors.giverName = `Keep your name under ${MAX_NAME} characters.`;

  const amountCents = parseMoney(raw.amount);
  if (amountCents === null || Number.isNaN(amountCents) || amountCents <= 0) {
    errors.amount = "Enter a valid amount greater than 0.";
  }

  const message = raw.message?.trim() || null;
  if (message && message.length > MAX_MESSAGE) {
    errors.message = `Keep your message under ${MAX_MESSAGE} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { giverName, amountCents: amountCents!, message } };
}

// ---------------------------------------------------------------- gift pictures

export type ImageMode = "keep" | "upload" | "shop" | "url" | "remove";

export function parseImageMode(value: string | null | undefined): ImageMode {
  if (value === "upload" || value === "shop" || value === "url" || value === "remove") return value;
  return "keep";
}

export type ImagePlan =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "upload" }
  | { kind: "shop"; url: string; required: boolean }
  | { kind: "url"; url: string };

/**
 * Decides how a gift item's picture should be updated on save.
 * - Explicit upload/shop/url modes validate their required input and surface errors on the `image` field.
 * - When adding a new item with a valid shop link and no picture chosen, automatically attempts
 *   a non-fatal shop import (`required: false`) so the item still saves if the shop blocks bots.
 */
export function resolveImagePlan(args: {
  isEdit: boolean;
  mode: ImageMode;
  hasFile: boolean;
  shopUrl: string | null;
  shopUrlInvalid?: boolean;
  imageLink: string | null;
}): { ok: true; plan: ImagePlan } | { ok: false; error: string } {
  const trimmedLink = (args.imageLink ?? "").trim();

  if (args.mode === "remove") {
    return { ok: true, plan: { kind: "remove" } };
  }

  if (args.mode === "upload") {
    if (!args.hasFile) return { ok: false, error: "Choose a picture to upload." };
    return { ok: true, plan: { kind: "upload" } };
  }

  if (args.mode === "shop") {
    if (!args.shopUrl) {
      if (args.shopUrlInvalid) return { ok: true, plan: { kind: "keep" } };
      return { ok: false, error: "Enter a store link above first." };
    }
    return { ok: true, plan: { kind: "shop", url: args.shopUrl, required: true } };
  }

  if (args.mode === "url") {
    if (!trimmedLink) return { ok: false, error: "Paste a link to a picture." };
    const checked = validateHttpUrl(trimmedLink);
    if (!checked.ok || !checked.value) {
      return { ok: false, error: checked.ok ? "Paste a link to a picture." : checked.error };
    }
    return { ok: true, plan: { kind: "url", url: checked.value } };
  }

  // mode === "keep"
  if (args.hasFile) return { ok: true, plan: { kind: "upload" } };
  if (trimmedLink) {
    const checked = validateHttpUrl(trimmedLink);
    if (!checked.ok || !checked.value) {
      return { ok: false, error: checked.ok ? "Paste a link to a picture." : checked.error };
    }
    return { ok: true, plan: { kind: "url", url: checked.value } };
  }
  if (!args.isEdit && args.shopUrl) {
    return { ok: true, plan: { kind: "shop", url: args.shopUrl, required: false } };
  }
  return { ok: true, plan: { kind: "keep" } };
}

// ---------------------------------------------------------------- received list

export type ReceivedFilter = "all" | "to_thank" | "pledged";

export type ReceivedEntry =
  | {
      kind: "claim";
      id: string;
      itemId: string;
      giverName: string;
      giverEmail: string | null;
      what: string;
      imageUrl: string | null;
      quantity: number;
      message: string | null;
      thankedAt: Date | null;
      createdAt: Date;
    }
  | {
      kind: "contribution";
      id: string;
      fundId: string;
      giverName: string;
      giverEmail: string | null;
      what: string;
      amountCents: number;
      message: string | null;
      received: boolean;
      thankedAt: Date | null;
      createdAt: Date;
    };

export function parseReceivedFilter(value: string | null | undefined): ReceivedFilter {
  if (value === "to_thank" || value === "pledged") return value;
  return "all";
}

export function buildReceivedEntries(args: {
  items: Array<{ id: string; name: string; imageUrl?: string | null }>;
  claims: Array<{
    id: string;
    itemId: string;
    giverName: string;
    giverEmail: string | null;
    quantity: number;
    message: string | null;
    thankedAt: Date | null;
    createdAt: Date;
  }>;
  funds: Array<{ id: string; name: string }>;
  contributions: Array<{
    id: string;
    fundId: string;
    giverName: string;
    giverEmail: string | null;
    amountCents: number;
    message: string | null;
    received: boolean;
    thankedAt: Date | null;
    createdAt: Date;
  }>;
}): ReceivedEntry[] {
  const itemsById = new Map(args.items.map((i) => [i.id, i]));
  const fundNames = new Map(args.funds.map((f) => [f.id, f.name]));

  const entries: ReceivedEntry[] = [
    ...args.claims.map((c): ReceivedEntry => {
      const item = itemsById.get(c.itemId);
      return {
        kind: "claim",
        id: c.id,
        itemId: c.itemId,
        giverName: c.giverName,
        giverEmail: c.giverEmail,
        what: item?.name ?? "Gift item",
        imageUrl: item?.imageUrl ?? null,
        quantity: c.quantity,
        message: c.message,
        thankedAt: c.thankedAt,
        createdAt: c.createdAt,
      };
    }),
    ...args.contributions.map(
      (c): ReceivedEntry => ({
        kind: "contribution",
        id: c.id,
        fundId: c.fundId,
        giverName: c.giverName,
        giverEmail: c.giverEmail,
        what: fundNames.get(c.fundId) ?? "Cash fund",
        amountCents: c.amountCents,
        message: c.message,
        received: c.received,
        thankedAt: c.thankedAt,
        createdAt: c.createdAt,
      }),
    ),
  ];

  return entries.sort((a, b) => {
    const diff = b.createdAt.getTime() - a.createdAt.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

export function filterReceivedEntries(entries: ReceivedEntry[], filter: ReceivedFilter): ReceivedEntry[] {
  switch (filter) {
    case "to_thank":
      return entries.filter((e) => !e.thankedAt);
    case "pledged":
      return entries.filter((e) => e.kind === "contribution" && !e.received);
    case "all":
      return entries;
  }
}

/** Plain-text list of givers and gifts for writing thank-you cards. */
export function formatThankYouCopyList(entries: ReceivedEntry[], currency: string): string {
  return entries
    .map((e) => {
      const giftPart =
        e.kind === "claim"
          ? e.quantity > 1
            ? `${e.what} × ${e.quantity}`
            : e.what
          : `${e.what} (${formatMoney(e.amountCents, currency)}${e.received ? "" : ", pledged"})`;
      const messagePart = e.message ? ` — "${e.message.replace(/\s+/g, " ").trim()}"` : "";
      return `${e.giverName} — ${giftPart}${messagePart}`;
    })
    .join("\n");
}
