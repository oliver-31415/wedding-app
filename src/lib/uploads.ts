import "server-only";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { newId } from "@/lib/ids";
import { detectImageType, findImageInHtml, isPublicAddress, type ImageType } from "./uploads-shared";

/**
 * Image storage for gift pictures. Files live in UPLOAD_DIR (default
 * ./data/uploads, next to the database — back both up together) and are
 * served from /uploads/<file>. Remote images are always downloaded and stored,
 * never hotlinked, so pictures don't break when a shop changes its site.
 */

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_HTML_BYTES = 1024 * 1024;
const EXT: Record<ImageType, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif" };
export const CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
export const UPLOAD_FILE_RE = /^[A-Za-z0-9_-]{8,40}\.(jpg|png|webp|gif)$/;

export type ImageResult = { ok: true; url: string } | { ok: false; error: string };

/** Validates the bytes really are an image (not just the claimed type) and stores them. */
export async function saveImage(bytes: Uint8Array): Promise<ImageResult> {
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "That picture is too large (5 MB max)." };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "That file isn't a JPEG, PNG, WebP or GIF picture." };
  const file = `${newId()}.${EXT[type]}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, file), bytes);
  return { ok: true, url: `/uploads/${file}` };
}

/** From a <input type="file"> in a Server Action's FormData. */
export async function saveUploadedImage(file: File): Promise<ImageResult> {
  if (file.size === 0) return { ok: false, error: "Choose a picture to upload." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "That picture is too large (5 MB max)." };
  return saveImage(new Uint8Array(await file.arrayBuffer()));
}

/** Downloads a picture from the web and stores it. */
export async function importImageFromUrl(url: string): Promise<ImageResult> {
  const res = await safeFetch(url, MAX_IMAGE_BYTES);
  if (!res.ok) return { ok: false, error: res.error };
  return saveImage(res.body);
}

/**
 * Finds the product picture on a shop page (its og:image / twitter:image)
 * and stores a copy. Returns an error if the shop doesn't publish one.
 */
export async function importImageFromProductPage(pageUrl: string): Promise<ImageResult> {
  const page = await safeFetch(pageUrl, MAX_HTML_BYTES);
  if (!page.ok) return { ok: false, error: page.error };
  const found = findImageInHtml(new TextDecoder().decode(page.body), page.finalUrl);
  if (!found) return { ok: false, error: "We couldn't find a picture on that page. Try uploading one instead." };
  return importImageFromUrl(found);
}

export async function readUpload(file: string): Promise<Buffer | null> {
  if (!UPLOAD_FILE_RE.test(file)) return null;
  try {
    return await readFile(path.join(UPLOAD_DIR, file));
  } catch {
    return null;
  }
}

/** Deletes a stored upload; ignores anything that isn't one of ours. */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  const file = url?.startsWith("/uploads/") ? url.slice("/uploads/".length) : null;
  if (!file || !UPLOAD_FILE_RE.test(file)) return;
  await unlink(path.join(UPLOAD_DIR, file)).catch(() => {});
}

// ------------------------------------------------------------ fetching safely

type FetchResult = { ok: true; body: Uint8Array; finalUrl: string } | { ok: false; error: string };

/**
 * Fetches a user-supplied URL without letting it reach the server's own
 * network: http(s) only, every hop's host must resolve to public addresses,
 * at most 3 redirects, 8 s timeout, body size capped.
 */
async function safeFetch(url: string, maxBytes: number): Promise<FetchResult> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { ok: false, error: "That doesn't look like a web address." };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false, error: "Use an http or https link." };
    if (parsed.username || parsed.password) return { ok: false, error: "That link isn't allowed." };
    try {
      const addresses = await lookup(parsed.hostname, { all: true });
      if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
        return { ok: false, error: "That link isn't allowed." };
      }
    } catch {
      return { ok: false, error: "We couldn't reach that website." };
    }
    let res: Response;
    try {
      res = await fetch(parsed, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; WeddingGiftList/1.0)", accept: "text/html,image/*;q=0.9,*/*;q=0.5" },
      });
    } catch {
      return { ok: false, error: "We couldn't reach that website." };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, parsed).toString();
      continue;
    }
    if (!res.ok || !res.body) return { ok: false, error: "That website didn't let us in (it may block automatic requests)." };
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) return { ok: false, error: "That file is too large." };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        // Pages: the <head> is what matters, so a truncated page is fine. Images: reject.
        if (maxBytes === MAX_HTML_BYTES) break;
        return { ok: false, error: "That file is too large." };
      }
      chunks.push(value);
    }
    const body = new Uint8Array(Math.min(total, maxBytes));
    let offset = 0;
    for (const c of chunks) {
      body.set(c.subarray(0, Math.min(c.byteLength, body.byteLength - offset)), offset);
      offset += c.byteLength;
      if (offset >= body.byteLength) break;
    }
    return { ok: true, body, finalUrl: parsed.toString() };
  }
  return { ok: false, error: "That link redirects too many times." };
}
