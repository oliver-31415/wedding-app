/** Pure helpers for src/lib/uploads.ts (kept separate so they can be unit-tested). */
import { isIP } from "node:net";

export type ImageType = "jpeg" | "png" | "webp" | "gif";

/** Identify an image by its first bytes rather than trusting the file name or headers. */
export function detectImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  )
    return "webp";
  return null;
}

/** False for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPublicAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (v === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return false;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]);
    if (/^f[cd]/.test(lower)) return false; // unique local
    if (/^fe[89ab]/.test(lower)) return false; // link-local
    if (/^ff/.test(lower)) return false; // multicast
    return true;
  }
  return false;
}

/** The page's product image: og:image, then twitter:image, then link rel=image_src. Absolute URL or null. */
export function findImageInHtml(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 300_000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag)?.[2];
  const pick = (keys: string[]) => {
    for (const key of keys) {
      for (const tag of metas) {
        const k = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
        const content = attr(tag, "content");
        if (k === key && content) return content;
      }
    }
    return null;
  };
  let found = pick(["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  if (!found) {
    const link = (head.match(/<link\b[^>]*>/gi) ?? []).find((t) => (attr(t, "rel") ?? "").toLowerCase() === "image_src");
    found = link ? (attr(link, "href") ?? null) : null;
  }
  if (!found) return null;
  try {
    const abs = new URL(found.replace(/&amp;/g, "&"), pageUrl);
    return abs.protocol === "https:" || abs.protocol === "http:" ? abs.toString() : null;
  } catch {
    return null;
  }
}
