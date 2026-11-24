/**
 * Simple in-memory sliding-window rate limiter for guest invitation lookups.
 * Survives HMR reloads via globalThis and prunes stale keys periodically.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  check: (key: string, now?: number) => RateLimitResult;
  reset: (key?: string) => void;
};

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const { limit, windowMs, maxKeys = 2000 } = opts;
  const buckets = new Map<string, number[]>();

  function prune(now: number) {
    const cutoff = now - windowMs;
    for (const [k, hits] of buckets) {
      const kept = hits.filter((t) => t > cutoff);
      if (kept.length === 0) buckets.delete(k);
      else buckets.set(k, kept);
    }
  }

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      if (buckets.size > maxKeys) prune(now);
      const cutoff = now - windowMs;
      const existing = buckets.get(key) ?? [];
      const recent = existing.filter((t) => t > cutoff);

      if (recent.length >= limit) {
        buckets.set(key, recent);
        const oldest = recent[0] ?? now;
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, oldest + windowMs - now),
        };
      }

      recent.push(now);
      buckets.set(key, recent);
      return {
        allowed: true,
        remaining: Math.max(0, limit - recent.length),
        retryAfterMs: 0,
      };
    },

    reset(key?: string) {
      if (key === undefined) buckets.clear();
      else buckets.delete(key);
    },
  };
}

/** Extract the client IP from standard proxy headers (`x-forwarded-for` first). */
export function extractClientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

const globalForRateLimit = globalThis as unknown as {
  waLookupRateLimiter?: RateLimiter;
};

/** 10 invitation lookups per minute per IP. */
export const lookupRateLimiter: RateLimiter =
  globalForRateLimit.waLookupRateLimiter ?? createRateLimiter({ limit: 10, windowMs: 60_000 });

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.waLookupRateLimiter = lookupRateLimiter;
}

const globalForGuestLimits = globalThis as unknown as { waGuestActionLimiter?: RateLimiter };

/**
 * Other public guest actions (site password attempts, gift claims, pledges):
 * 10 per minute per IP + wedding. Key with `${action}:${slug}:${ip}`.
 */
export const guestActionLimiter: RateLimiter =
  globalForGuestLimits.waGuestActionLimiter ?? createRateLimiter({ limit: 10, windowMs: 60_000 });
if (process.env.NODE_ENV !== "production") globalForGuestLimits.waGuestActionLimiter = guestActionLimiter;
