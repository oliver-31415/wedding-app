/**
 * Validates `?next=` redirect targets so guests can only be redirected to a
 * safe path within the same wedding site (`/w/{slug}`).
 */
export function resolveSafeNext(
  slug: string,
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

  const base = `/w/${slug}`;
  if (trimmed !== base && !trimmed.startsWith(`${base}/`) && !trimmed.startsWith(`${base}?`) && !trimmed.startsWith(`${base}#`)) {
    return fallback;
  }

  // Verify the path part does not traverse outside `/w/{slug}`.
  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? "";
  const segments = pathOnly.split("/");
  if (segments.some((seg) => seg === ".." || seg === ".")) {
    return fallback;
  }

  return trimmed;
}
