import { describe, expect, it } from "vitest";
import { createRateLimiter, extractClientIp } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within a minute and blocks the next request", () => {
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      const r = limiter.check("1.2.3.4", t0 + i * 100);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(9 - i);
    }
    const blocked = limiter.check("1.2.3.4", t0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("recovers after the sliding window passes", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check("ip-a", 0).allowed).toBe(true);
    expect(limiter.check("ip-a", 10_000).allowed).toBe(true);
    expect(limiter.check("ip-a", 20_000).allowed).toBe(false);
    // After 60s from the first hit, one slot opens up.
    expect(limiter.check("ip-a", 60_001).allowed).toBe(true);
    expect(limiter.check("ip-a", 60_002).allowed).toBe(false);
  });

  it("tracks IPs independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("ip-1", 100).allowed).toBe(true);
    expect(limiter.check("ip-1", 101).allowed).toBe(false);
    expect(limiter.check("ip-2", 102).allowed).toBe(true);
  });
});

describe("extractClientIp", () => {
  it("reads the first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(extractClientIp(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip and unknown", () => {
    expect(extractClientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(extractClientIp(new Headers())).toBe("unknown");
  });
});
