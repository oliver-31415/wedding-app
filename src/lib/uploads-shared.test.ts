import { describe, expect, it } from "vitest";
import { detectImageType, findImageInHtml, isPublicAddress } from "./uploads-shared";

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
