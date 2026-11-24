import { describe, expect, it } from "vitest";
import {
  detectImageType,
  findImageInHtml,
  isAnimatedImage,
  isPublicAddress,
  readImageSize,
  stripImageMetadata,
} from "./uploads-shared";

describe("isPublicAddress", () => {
  it("blocks internal addresses", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicAddress(a), a).toBe(false);
    }
  });
  it("allows public addresses", () => {
    for (const a of ["8.8.8.8", "203.0.113.5", "2606:4700::1111", "::ffff:1.1.1.1"]) expect(isPublicAddress(a), a).toBe(true);
  });
});

describe("detectImageType", () => {
  it("reads magic bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("png");
    expect(detectImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("webp");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("findImageInHtml", () => {
  it("prefers og:image and resolves relative URLs", () => {
    const html = `<head><meta name="twitter:image" content="/t.jpg"><meta content="/img/p.jpg?a=1&amp;b=2" property="og:image"></head>`;
    expect(findImageInHtml(html, "https://shop.example/products/x")).toBe("https://shop.example/img/p.jpg?a=1&b=2");
  });
  it("falls back to twitter:image and image_src, and ignores non-http", () => {
    expect(findImageInHtml(`<meta name="twitter:image" content="https://cdn.example/t.png">`, "https://a.example")).toBe("https://cdn.example/t.png");
    expect(findImageInHtml(`<link rel="image_src" href="//cdn.example/l.png">`, "https://a.example")).toBe("https://cdn.example/l.png");
    expect(findImageInHtml(`<meta property="og:image" content="javascript:alert(1)">`, "https://a.example")).toBeNull();
    expect(findImageInHtml(`<p>nothing</p>`, "https://a.example")).toBeNull();
  });
});

// 5×3 pictures; the JPEG carries EXIF with a camera make and GPS position.
const FX = {
  jpegExif: "/9j/4AAQSkZJRgABAQAAAQABAAD/4QCcRXhpZgAATU0AKgAAAAgAAgEPAAIAAAAIAAAAJoglAAQAAAABAAAALgAAAABUZXN0Q2FtAAAEAAEAAgAAAAJTAAAAAAIABQAAAAMAAABkAAMAAgAAAAJFAAAAAAQABQAAAAMAAAB8AAAAAAAAACEAAAABAAAANAAAAAEAAAAAAAAAAQAAAJcAAAABAAAADAAAAAEAAAAAAAAAAf/bAEMACAYGBwYFCAcHBwkJCAoMFA0MCwsMGRITDxQdGh8eHRocHCAkLicgIiwjHBwoNyksMDE0NDQfJzk9ODI8LjM0Mv/bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIAAMABQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AI6KKK+aPsD/2Q==",
  png: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAADCAIAAADUVFKvAAAAFElEQVR4nGM8kWLEgASYGFABOh8AQDoBZEn3LHgAAAAASUVORK5CYII=",
  gif: "R0lGODdhBQADAIEAAMhkMgAAAAAAAAAAACwAAAAABQADAAAICAABCBxIsGBAADs=",
  webpLossy: "UklGRjoAAABXRUJQVlA4IC4AAADwAQCdASoFAAMAAUAmJaACdLoB+AAEyAAA/q4X/zYEDND6YP/SbPE2eJs+OYAA",
  webpLossless: "UklGRh4AAABXRUJQVlA4TBEAAAAvBIAAAAdQsiJXpv+BiOh/AAA=",
  webpExtended: "UklGRugAAABXRUJQVlA4WAoAAAAIAAAABAAAAgAAVlA4IC4AAADwAQCdASoFAAMAAUAmJaACdLoB+AAEyAAA/q4X/zYEDND6YP/SbPE2eJs+OYAARVhJRpQAAABNTQAqAAAACAACAQ8AAgAAAAgAAAAmiCUABAAAAAEAAAAuAAAAAFRlc3RDYW0AAAQAAQACAAAAAlMAAAAAAgAFAAAAAwAAAGQAAwACAAAAAkUAAAAABAAFAAAAAwAAAHwAAAAAAAAAIQAAAAEAAAA0AAAAAQAAAAAAAAABAAAAlwAAAAEAAAAMAAAAAQAAAAAAAAAB",
};
const MORE = {
  pngExif: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAADCAIAAADUVFKvAAAAZGVYSWZNTQAqAAAACAACAQ8AAgAAAAgAAAAmiCUABAAAAAEAAAAuAAAAAFRlc3RDYW0AAAIAAQACAAAAAlMAAAAAAgAFAAAAAwAAAEwAAAAAAAAAIQAAAAEAAAA0AAAAAQAAAAAAAAABzeYUOwAAABRJREFUeJxjPJFixIAEmBhQATofAEA6AWRJ9yx4AAAAAElFTkSuQmCC",
  webpAnimated: "UklGRsQAAABXRUJQVlA4WAoAAAACAAAABAAAAgAAQU5JTQYAAAAAAAAAAABBTk1GSgAAAAAAAAAAAAQAAAIAAGQAAAJWUDggMgAAADABAJ0BKgUAAwABQCYloAADcAD+8ut///mwP/bz/wR6Af//0uD//pcH//S4P/SkAAAAQU5NRkYAAAAAAAAAAAAEAAACAABkAAAAVlA4IC4AAAA0AQCdASoFAAMAAAAmJaAAA3AA/vtV4///S4P/+lwf/9Lg/9Lg//rV5Vesq6AA",
  pngAnimated: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAADCAIAAADUVFKvAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAAFAAAAAwAAAAAAAAAAAAEACgAAG5GMowAAABBJREFUeJxj/M+AApgY8PMBL5EBBbESMnoAAAAaZmNUTAAAAAEAAAAFAAAAAwAAAAAAAAAAAAEACgAAgOJmdwAAABhmZEFUAAAAAnicY2Rg+M+ABJgYUAE6HwAtkwEFEjuR9QAAAABJRU5ErkJggg==",
};
const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));
const has = (b: Uint8Array, text: string) => Buffer.from(b).includes(Buffer.from(text));

describe("readImageSize", () => {
  it("reads width and height from every supported format", () => {
    for (const key of Object.keys(FX) as (keyof typeof FX)[]) {
      expect(readImageSize(bytes(FX[key])), key).toEqual({ width: 5, height: 3 });
    }
  });

  it("returns null for anything else", () => {
    expect(readImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("stripImageMetadata", () => {
  it("removes EXIF (camera and GPS) from a JPEG but keeps a readable picture", () => {
    const original = bytes(FX.jpegExif);
    expect(has(original, "TestCam")).toBe(true);
    const stripped = stripImageMetadata(original)!;
    expect(has(stripped, "TestCam")).toBe(false);
    expect(has(stripped, "Exif")).toBe(false);
    expect(readImageSize(stripped)).toEqual({ width: 5, height: 3 });
    expect(Array.from(stripped.slice(-2))).toEqual([0xff, 0xd9]);
  });

  it("still finds the EXIF when the JPEG has fill bytes before a marker", () => {
    const original = bytes(FX.jpegExif);
    const padded = new Uint8Array([...original.subarray(0, 2), 0xff, 0xff, ...original.subarray(2)]);
    const stripped = stripImageMetadata(padded)!;
    expect(has(stripped, "TestCam")).toBe(false);
    expect(readImageSize(padded)).toEqual({ width: 5, height: 3 });
  });

  it("refuses a JPEG whose structure can't be followed instead of keeping its metadata", () => {
    const original = bytes(FX.jpegExif);
    const broken = original.slice(0, 40);
    expect(stripImageMetadata(broken)).toBeNull();
    const badLength = original.slice();
    badLength[4] = 0;
    badLength[5] = 1;
    expect(stripImageMetadata(badLength)).toBeNull();
  });

  it("removes EXIF from PNG and WebP", () => {
    for (const b64 of [MORE.pngExif, FX.webpExtended]) {
      const original = bytes(b64);
      expect(has(original, "TestCam")).toBe(true);
      const stripped = stripImageMetadata(original)!;
      expect(has(stripped, "TestCam")).toBe(false);
      expect(detectImageType(stripped)).toBe(detectImageType(original));
      expect(readImageSize(stripped)).toEqual({ width: 5, height: 3 });
    }
    // The WebP's RIFF size and "has EXIF" flag are updated.
    const webp = stripImageMetadata(bytes(FX.webpExtended))!;
    expect(new DataView(webp.buffer).getUint32(4, true)).toBe(webp.length - 8);
    expect(webp[20] & 0x08).toBe(0);
  });
});

describe("isAnimatedImage", () => {
  it("spots animations so they can't be used as photos", () => {
    expect(isAnimatedImage(bytes(MORE.webpAnimated))).toBe(true);
    expect(isAnimatedImage(bytes(MORE.pngAnimated))).toBe(true);
    expect(isAnimatedImage(bytes(FX.gif))).toBe(true);
    for (const still of [FX.jpegExif, FX.png, FX.webpLossy, FX.webpExtended]) expect(isAnimatedImage(bytes(still))).toBe(false);
  });
});
