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

type JpegSegment = { marker: number; start: number; end: number; body: number };

/**
 * The segments of a JPEG before its image data, or null if the structure is
 * malformed. Handles fill bytes (extra 0xFF before a marker) and markers
 * without a length.
 */
function jpegSegments(b: Uint8Array): { segments: JpegSegment[]; dataStart: number } | null {
  const segments: JpegSegment[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let m = i + 1;
    while (m < b.length && b[m] === 0xff) m++;
    if (m >= b.length) return null;
    const marker = b[m];
    // Start of scan (image data follows) or end of image.
    if (marker === 0xda || marker === 0xd9) return { segments, dataStart: i };
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, start: i, end: m + 1, body: m + 1 });
      i = m + 1;
      continue;
    }
    if (m + 2 >= b.length) return null;
    const len = (b[m + 1] << 8) | b[m + 2];
    const end = m + 1 + len;
    if (len < 2 || end > b.length) return null;
    segments.push({ marker, start: i, end, body: m + 3 });
    i = end;
  }
  return null;
}

/** Pixel size from the image header, or null if it can't be read. */
export function readImageSize(b: Uint8Array): { width: number; height: number } | null {
  const type = detectImageType(b);
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u16le = (i: number) => b[i] | (b[i + 1] << 8);
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32be = (i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
  if (type === "png" && b.length >= 24) return { width: u32be(16), height: u32be(20) };
  if (type === "gif" && b.length >= 10) return { width: u16le(6), height: u16le(8) };
  if (type === "webp" && b.length >= 30) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: u24le(24) + 1, height: u24le(27) + 1 };
    return null;
  }
  if (type === "jpeg") {
    // Start-of-frame markers carry the size (C4, C8 and CC are not frames).
    const frame = jpegSegments(b)?.segments.find(
      (s) => s.marker >= 0xc0 && s.marker <= 0xcf && s.marker !== 0xc4 && s.marker !== 0xc8 && s.marker !== 0xcc,
    );
    if (!frame || frame.end - frame.body < 5) return null;
    return { width: u16be(frame.body + 3), height: u16be(frame.body + 1) };
  }
  return null;
}

/** True for animations (animated WebP or PNG, and every GIF): photos never move. */
export function isAnimatedImage(b: Uint8Array): boolean {
  const type = detectImageType(b);
  if (type === "gif") return true;
  if (type === "webp") return String.fromCharCode(b[12], b[13], b[14], b[15]) === "VP8X" && (b[20] & 0x02) !== 0;
  if (type === "png") return pngChunks(b)?.some((c) => c.type === "acTL") ?? false;
  return false;
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

type PngChunk = { type: string; start: number; end: number };
function pngChunks(b: Uint8Array): PngChunk[] | null {
  const chunks: PngChunk[] = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const end = i + 12 + len;
    if (end > b.length) return null;
    chunks.push({ type, start: i, end });
    if (type === "IEND") return chunks;
    i = end;
  }
  return null;
}

/**
 * Removes camera metadata — EXIF (including the GPS position a phone saved),
 * XMP and text chunks — from a JPEG, PNG or WebP, keeping colour profiles.
 * Photos are normally re-encoded in the browser, which already does this;
 * this is the safety net for anything that wasn't. Returns null when a file's
 * structure can't be followed, so it's refused rather than stored with its
 * metadata.
 */
export function stripImageMetadata(b: Uint8Array): Uint8Array | null {
  const type = detectImageType(b);
  if (type === "jpeg") {
    const parsed = jpegSegments(b);
    if (!parsed) return null;
    const kept = parsed.segments.filter((s) => s.marker !== 0xe1).map((s) => b.subarray(s.start, s.end));
    return concat([b.subarray(0, 2), ...kept, b.subarray(parsed.dataStart)]);
  }
  if (type === "png") {
    const chunks = pngChunks(b);
    if (!chunks) return null;
    const drop = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
    return concat([b.subarray(0, 8), ...chunks.filter((c) => !drop.has(c.type)).map((c) => b.subarray(c.start, c.end))]);
  }
  if (type === "webp") {
    const parts: Uint8Array[] = [];
    let i = 12;
    while (i + 8 <= b.length) {
      const fourcc = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
      const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | ((b[i + 7] << 24) >>> 0);
      const end = i + 8 + size + (size % 2);
      if (end > b.length) return null;
      if (fourcc === "VP8X") {
        const chunk = b.slice(i, end);
        chunk[8] &= ~0x0c; // clear the "has EXIF" and "has XMP" flags
        parts.push(chunk);
      } else if (fourcc !== "EXIF" && fourcc !== "XMP ") {
        parts.push(b.subarray(i, end));
      }
      i = end;
    }
    const body = concat(parts);
    const header = new Uint8Array(12);
    header.set(b.subarray(0, 12));
    new DataView(header.buffer).setUint32(4, body.length + 4, true);
    return concat([header, body]);
  }
  return b;
}
