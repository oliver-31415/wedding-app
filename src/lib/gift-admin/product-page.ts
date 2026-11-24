/**
 * Reads a shop's product page for "Fill in from a link" on the gift form:
 * name, price, picture and store name. Pure (no network), so it can be tested
 * with saved pages. Sources, best first: schema.org Product data (JSON-LD),
 * Open Graph / product meta tags, then a few common page patterns. Anything
 * it can't find confidently is left out for the couple to type.
 */
import { MAX_NAME, MAX_STORE, suggestStoreFromUrl } from "./helpers";

export type ProductDetails = {
  name: string | null;
  storeName: string | null;
  priceCents: number | null;
  /** ISO code when the page states one, e.g. "AUD". */
  currency: string | null;
  /** Absolute http(s) URL of the product picture (not yet downloaded). */
  imageUrl: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", trade: "™", reg: "®", copy: "©" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const tidy = (s: string | null | undefined, max: number): string | null => {
  const t = decodeEntities(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function absolute(raw: string | null | undefined, pageUrl: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(decodeEntities(raw.trim()), pageUrl);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "1,299.00" / 1299 / "$1299" → 129900; null for anything that isn't a sensible price. */
export function toCents(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[^0-9.]/g, "")) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}

// ---------------------------------------------------------------- sources

type Json = unknown;
const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const isType = (node: Record<string, Json>, type: string) => asArray(node["@type"]).includes(type);

/** The first schema.org Product (or ProductGroup) in the page's JSON-LD. */
function jsonLdProduct(html: string): Record<string, Json> | null {
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: Json;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack: Json[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === "object") {
        const obj = node as Record<string, Json>;
        if (isType(obj, "Product") || isType(obj, "ProductGroup")) return obj;
        stack.push(...Object.values(obj));
      }
    }
  }
  return null;
}

function ldImage(product: Record<string, Json>): string | null {
  for (const img of asArray(product.image)) {
    if (typeof img === "string") return img;
    if (img && typeof img === "object") {
      const url = (img as Record<string, Json>).url ?? (img as Record<string, Json>).contentUrl;
      if (typeof url === "string") return url;
    }
  }
  return null;
}

function ldPrice(product: Record<string, Json>): { cents: number | null; currency: string | null } {
  // Variants (ProductGroup) carry their own offers.
  const offerSources = [product.offers, ...asArray(product.hasVariant).map((v) => (v as Record<string, Json>)?.offers)];
  for (const source of offerSources) {
    for (const offer of asArray(source)) {
      if (!offer || typeof offer !== "object") continue;
      const o = offer as Record<string, Json>;
      const spec = asArray(o.priceSpecification)[0] as Record<string, Json> | undefined;
      const cents = toCents(o.price ?? o.lowPrice ?? spec?.price);
      if (cents) {
        const currency = o.priceCurrency ?? spec?.priceCurrency;
        return { cents, currency: typeof currency === "string" ? currency.toUpperCase() : null };
      }
    }
  }
  return { cents: null, currency: null };
}

function metaTags(html: string): Map<string, string> {
  const head = html.slice(0, 600_000);
  const map = new Map<string, string>();
  const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(tag)?.[2];
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !map.has(key)) map.set(key, content);
  }
  return map;
}

/** A price stated the same way everywhere in the page's data ("price": "651.00"), if only one. */
function onlyPriceInPage(html: string): number | null {
  const found = new Set<number>();
  for (const m of html.matchAll(/["']price["']\s*:\s*["']?([0-9][0-9,]*(?:\.[0-9]+)?)/g)) {
    const cents = toCents(m[1]);
    if (cents) found.add(cents);
    if (found.size > 1) return null;
  }
  return found.size === 1 ? [...found][0] : null;
}

const looksLikeLogo = (url: string) => /logo|placeholder|default[-_]?og|open-?graph|share[-_]image/i.test(url);

/** Drops " | Store" style suffixes that name the shop. */
function stripStoreSuffix(title: string, storeHints: string[]): { name: string; suffix: string | null } {
  const parts = title.split(/\s+[|–—:-]\s+/);
  const hints = storeHints.map(squash).filter((h) => h.length >= 3);
  let suffix: string | null = null;
  while (parts.length > 1) {
    const last = squash(parts[parts.length - 1]);
    if (!last || !hints.some((h) => last.includes(h) || (last.length >= 4 && h.includes(last)))) break;
    suffix = parts.pop()!;
  }
  return { name: parts.join(" - "), suffix };
}

// ---------------------------------------------------------------- main

export function extractProductDetails(html: string, pageUrl: string): ProductDetails {
  const product = jsonLdProduct(html);
  const meta = metaTags(html);
  const host = suggestStoreFromUrl(pageUrl) ?? "";
  const hostLabel = host.split(".")[0] ?? "";
  const siteName = tidy(meta.get("og:site_name"), MAX_STORE)?.replace(/[™®]/g, "").trim() || null;

  // Name: the page's own product name, in the nicer of the casings on offer.
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const amazonTitle = /id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i.exec(html)?.[1];
  const pageTitle = tidy(meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag, 400);
  const { name: titleName, suffix } = pageTitle
    ? stripStoreSuffix(pageTitle, [siteName ?? "", hostLabel])
    : { name: null, suffix: null };
  const ldName = tidy(typeof product?.name === "string" ? product.name : null, 400);
  let name = tidy(amazonTitle, 400) ?? ldName ?? titleName;
  // Prefer the page title when it's the same product name in better casing
  // (some shops shout their data: "COVERED CASSEROLE 30CM").
  if (ldName && titleName && ldName === ldName.toUpperCase() && squash(titleName).includes(squash(ldName))) {
    name = titleName;
  }

  // Price
  let { cents: priceCents, currency } = product ? ldPrice(product) : { cents: null, currency: null as string | null };
  if (!priceCents) {
    priceCents =
      toCents(meta.get("product:price:amount")) ??
      toCents(meta.get("og:price:amount")) ??
      toCents(meta.get("price")) ??
      onlyPriceInPage(html);
    currency = (meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? meta.get("pricecurrency") ?? null)?.toUpperCase() ?? null;
  }

  // Picture: the product's own image before the page's sharing image, which is
  // sometimes just the shop's logo.
  const ldPicture = product ? ldImage(product) : null;
  // A structured-data thumbnail is worse than the page's full-size sharing image.
  const ldIsThumb = !!ldPicture && /thumb|small|[_-]sm\b/i.test(ldPicture);
  const candidates = [
    ldIsThumb ? null : ldPicture,
    /data-old-hires=["']([^"']+)["']/i.exec(html)?.[1] ?? null,
    meta.get("og:image:secure_url") ?? null,
    meta.get("og:image") ?? null,
    meta.get("twitter:image") ?? null,
    /["']image["']\s*:\s*["'](https?:[^"']+)["']/i.exec(html)?.[1]?.replace(/\\\//g, "/") ?? null,
    ldIsThumb ? ldPicture : null,
  ];
  const imageUrl =
    candidates.map((c) => absolute(c, pageUrl)).find((u): u is string => !!u && !looksLikeLogo(u)) ?? null;

  // From a removed title suffix, only the piece naming the shop ("…: Dutch Ovens: Amazon.com.au").
  const fromSuffix =
    suffix
      ?.split(/[:|–—]/)
      .map((p) => tidy(p, MAX_STORE)?.replace(/[™®]/g, "").trim() ?? "")
      .find((p) => p && hostLabel.length >= 3 && squash(p).includes(squash(hostLabel))) ?? null;
  const storeName = (siteName ?? fromSuffix ?? host) || null;

  return {
    name: name ? name.slice(0, MAX_NAME) : null,
    storeName: storeName ? storeName.slice(0, MAX_STORE) : null,
    priceCents,
    currency,
    imageUrl,
  };
}
