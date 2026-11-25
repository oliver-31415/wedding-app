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
type Obj = Record<string, Json>;
type Price = { cents: number | null; currency: string | null };
const NO_PRICE: Price = { cents: null, currency: null };
const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const isObj = (v: Json): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
// Some shops write "type" without the "@".
const isType = (node: Obj, type: string) => asArray(node["@type"] ?? node.type).includes(type);
const currencyCode = (v: Json): string | null =>
  typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : null;

/** The first schema.org Product (or ProductGroup) in the page's JSON-LD. */
function jsonLdProduct(html: string): Obj | null {
  // "ld+json", sometimes with the "+" written as an HTML entity.
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld(?:\+|&#x2B;|&#43;|&plus;)json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
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

function ldImage(product: Obj): string | null {
  for (const img of asArray(product.image)) {
    if (typeof img === "string") return img;
    if (img && typeof img === "object") {
      const url = (img as Record<string, Json>).url ?? (img as Record<string, Json>).contentUrl;
      if (typeof url === "string") return url;
    }
  }
  return null;
}

/** A price specification that's the old or recommended price, not what you'd pay now. */
const isWasPrice = (spec: Obj) => /strikethrough|listprice|srp|msrp|rrp|was/i.test(String(spec.priceType ?? ""));

function ldPrice(product: Obj): Price {
  // Variants (ProductGroup) carry their own offers; an AggregateOffer may list its offers.
  const offers: Json[] = [];
  const addOffers = (source: Json) => {
    for (const o of asArray(source)) {
      offers.push(o);
      if (isObj(o) && o.offers) offers.push(...asArray(o.offers));
    }
  };
  addOffers(product.offers);
  for (const variant of asArray(product.hasVariant)) if (isObj(variant)) addOffers(variant.offers);
  for (const o of offers) {
    if (!isObj(o)) continue;
    const spec = asArray(o.priceSpecification).filter(isObj).find((s) => !isWasPrice(s) && toCents(s.price));
    const cents = toCents(o.price) ?? toCents(o.lowPrice) ?? toCents(spec?.price);
    if (cents) return { cents, currency: currencyCode(o.priceCurrency) ?? currencyCode(spec?.priceCurrency) };
  }
  return NO_PRICE;
}

const attr = (tag: string, name: string) =>
  new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(tag)?.[2];

function metaTags(html: string): Map<string, string> {
  const head = html.slice(0, 600_000);
  const map = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !map.has(key)) map.set(key, content);
  }
  return map;
}

/** The one value in `values`, or null when there are none or they disagree. */
const onlyOne = <T>(values: Iterable<T>): T | null => {
  const set = new Set(values);
  return set.size === 1 ? [...set][0] : null;
};

/**
 * Whether the page shows this amount with a dollar sign ("$1,299", "$49.00").
 * Used to tell whether a bare whole number in page data is dollars or cents.
 */
function shownAsPrice(html: string, cents: number): boolean {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",?");
  const part = cents % 100 === 0 ? "(?:\\.00)?" : `\\.${String(cents % 100).padStart(2, "0")}`;
  return new RegExp(`\\$\\s?${whole}${part}(?![0-9]|[.,][0-9])`).test(html);
}

/**
 * An amount from a shop's own data. Decimals are dollars ("49.95"). A whole
 * number may be dollars (Myer's 99) or cents (Shopify's 4900), so it only
 * counts when the page shows it as exactly one of the two.
 */
function dataAmount(raw: Json, html: string): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\$?[0-9][0-9,]*(\.[0-9]+)?$/.test(text)) return null;
  if (text.includes(".") || text.startsWith("$")) return toCents(text);
  const ifDollars = toCents(text);
  if (!ifDollars) return null;
  const ifCents = ifDollars / 100;
  const dollarsShown = shownAsPrice(html, ifDollars);
  return dollarsShown === shownAsPrice(html, ifCents) ? null : dollarsShown ? ifDollars : ifCents;
}

/** Currency codes stated next to a price, e.g. "priceCurrency": "AUD". */
const CURRENCY_KEY = /["'](?:priceCurrency|currencyCode|currencyIso|currency)["']\s*:\s*["']([A-Za-z]{3})["']/;

/**
 * A price stated the same way throughout the page's data ("price": "651.00").
 * A price seen only once may belong to something else on the page (a
 * membership, a delivery fee), so it needs to appear at least twice.
 */
function onlyPriceInPage(html: string): Price {
  const prices: number[] = [];
  const currencies: string[] = [];
  for (const m of html.matchAll(/["']price["']\s*:\s*(["']?)(\$?[0-9][0-9,]*(?:\.[0-9]+)?)\1(?![0-9])/g)) {
    const cents = dataAmount(m[2], html);
    if (!cents) continue;
    prices.push(cents);
    const near = CURRENCY_KEY.exec(html.slice(m.index, m.index + 200))?.[1];
    if (near) currencies.push(near.toUpperCase());
  }
  const cents = prices.length >= 2 ? onlyOne(prices) : null;
  return cents ? { cents, currency: onlyOne(currencies) } : NO_PRICE;
}

/** schema.org microdata: <span itemprop="price" content="49.00">, when the page agrees on one. */
function microdataPrice(html: string): Price {
  const read = (prop: string) =>
    [...html.matchAll(new RegExp(`<[a-z][^>]*\\sitemprop\\s*=\\s*["']${prop}["'][^>]*>([^<]{0,40})`, "gi"))].map(
      (m) => attr(m[0], "content") ?? decodeEntities(m[1]),
    );
  const prices = read("price").map(toCents).filter((c): c is number => !!c);
  const cents = prices.length ? onlyOne(prices) : onlyOne(read("lowPrice").map(toCents).filter((c): c is number => !!c));
  return cents ? { cents, currency: onlyOne(read("priceCurrency").map(currencyCode).filter((c) => !!c)) } : NO_PRICE;
}

/** Amazon's buy box: the price you'd pay for the item on the page. */
function amazonPrice(html: string): Price {
  const input = (pattern: string) => {
    const tag = new RegExp(`<input\\b[^>]*${pattern}[^>]*>`, "i").exec(html)?.[0];
    return tag ? attr(tag, "value") : undefined;
  };
  const amount = input("customerVisiblePrice\\]\\[amount\\]") ?? input(`id=["']twister-plus-price-data-price["']`);
  const shown = /apex-pricetopay-value["'][^>]*>\s*<span class=["']a-offscreen["']>\s*\$([0-9][0-9,]*(?:\.[0-9]+)?)\s*</i.exec(html)?.[1];
  const cents = toCents(amount) ?? toCents(shown);
  return cents ? { cents, currency: currencyCode(input("customerVisiblePrice\\]\\[currencyCode\\]")) } : NO_PRICE;
}

/** A money value from page data: 49.95, "49.95", { value: 42, currencyIso: "AUD" }, { centAmount: 4200 }. */
function moneyValue(v: Json, html: string): Price {
  if (isObj(v)) {
    const currency = currencyCode(v.currencyIso ?? v.currencyCode ?? v.currency);
    if (typeof v.centAmount === "number") return v.centAmount > 0 ? { cents: Math.round(v.centAmount), currency } : NO_PRICE;
    const amount = v.value ?? v.amount;
    // A money object that names its currency is in dollars, not cents.
    const cents = currency && (typeof amount === "number" || typeof amount === "string") ? toCents(amount) : dataAmount(amount, html);
    return cents ? { cents, currency } : NO_PRICE;
  }
  const cents = dataAmount(v, html);
  return cents ? { cents, currency: null } : NO_PRICE;
}

/** Next.js shops: the product in the page's __NEXT_DATA__ (pageProps.product or close to it). */
function nextDataPrice(html: string): Price {
  const raw = /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!raw) return NO_PRICE;
  let data: Json;
  try {
    data = JSON.parse(raw);
  } catch {
    return NO_PRICE;
  }
  const props = isObj(data) && isObj(data.props) ? data.props.pageProps : null;
  let level: Json[] = [props];
  let product: Obj | null = null;
  for (let depth = 0; depth < 3 && !product && level.length; depth++) {
    product = level.filter(isObj).map((o) => o.product).find(isObj) ?? null;
    level = level.filter(isObj).flatMap((o) => Object.values(o));
  }
  if (!product) return NO_PRICE;
  for (const key of ["price", "currentPrice", "sellingPrice", "salePrice"]) {
    const p = moneyValue(product[key], html);
    if (p.cents) return p;
  }
  // A range ("from $27") is read like schema.org's lowPrice.
  const range = product.priceRange;
  return isObj(range) ? moneyValue(range.minPrice ?? range.min, html) : NO_PRICE;
}

/** The one currency the page's price data names, if it names exactly one. */
function pageCurrency(html: string, meta: Map<string, string>): string | null {
  const codes = [...html.matchAll(new RegExp(CURRENCY_KEY.source, "g"))].map((m) => m[1].toUpperCase());
  for (const key of ["product:price:currency", "og:price:currency", "pricecurrency"]) {
    const code = currencyCode(meta.get(key));
    if (code) codes.push(code);
  }
  return onlyOne(codes);
}

/**
 * Bot checks some shops answer with instead of the page ("Just a moment…",
 * "Pardon Our Interruption"), sometimes with a 200 status.
 */
export function looksLikeBlockedPage(html: string): boolean {
  if (html.length > 100_000) return false;
  const title = tidy(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1], 200) ?? "";
  return (
    /^(just a moment|pardon our interruption|access denied|attention required|are you a robot|security check)/i.test(title) ||
    /window\.KPSDK|challenges\.cloudflare\.com|_Incapsula_Resource/.test(html)
  );
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

  // Price: structured data first, then shop-specific patterns, then the page's own data.
  const metaCurrency = currencyCode(meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? meta.get("pricecurrency"));
  const fromMeta = (key: string): Price => {
    const cents = toCents(meta.get(key));
    return cents ? { cents, currency: metaCurrency } : NO_PRICE;
  };
  const priceSources: (() => Price)[] = [
    () => (product ? ldPrice(product) : NO_PRICE),
    () => fromMeta("product:price:amount"),
    () => fromMeta("og:price:amount"),
    () => microdataPrice(html),
    () => fromMeta("price"),
    () => amazonPrice(html),
    () => nextDataPrice(html),
    () => onlyPriceInPage(html),
  ];
  let price = NO_PRICE;
  for (const source of priceSources) {
    price = source();
    if (price.cents) break;
  }
  const priceCents = price.cents;
  // A price with no stated currency on an Australian shop is in dollars (AUD).
  const currency = priceCents
    ? (price.currency ?? metaCurrency ?? (host.endsWith(".au") ? "AUD" : pageCurrency(html, meta)))
    : null;

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
