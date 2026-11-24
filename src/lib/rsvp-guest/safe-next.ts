import { isWithinSite } from "@/lib/site-paths";

/**
 * Validates `?next=` redirect targets so guests can only be redirected to a
 * safe path within the same wedding site (its base from src/lib/site-paths.ts:
 * `/w/{slug}`, or the whole domain when the wedding is served at the root).
 */
export function resolveSafeNext(
  base: string,
  rawNext: string | null | undefined,
  fallback: string,
): string {
  if (!rawNext) return fallback;
  const trimmed = rawNext.trim();
  if (!trimmed) return fallback;

  // Reject protocol-relative URLs, backslashes, or control characters.
  if (trimmed.startsWith("//") || trimmed.includes("\\") || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return fallback;
  }

  if (!isWithinSite(base, trimmed)) return fallback;

  // Verify the path part does not traverse outside the site.
  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? "";
  const segments = pathOnly.split("/");
  if (segments.some((seg) => seg === ".." || seg === ".")) {
    return fallback;
  }

  return trimmed;
}
