/**
 * Where a wedding's guest site lives. A server that hosts one wedding (no
 * SUPERUSER_EMAILS) serves it from the root of the domain, so its base is "";
 * otherwise the base is /w/{slug}. Build every guest-site link from the
 * wedding's base with these helpers instead of writing /w/ by hand.
 *
 * Root requests reach the /w/[slug] routes through the rewrites in
 * next.config.ts, which use ROOT_SITE_SLUG as the slug.
 */
export const ROOT_SITE_SLUG = "_";

export const slugBase = (slug: string) => `/w/${slug}`;

/** A path on the guest site: sitePath("", "rsvp") = "/rsvp", sitePath("/w/a-b") = "/w/a-b". */
export function sitePath(base: string, sub = ""): string {
  const rest = sub.replace(/^\/+/, "");
  if (!rest) return base || "/";
  return `${base}/${rest}`;
}

/** True when `path` (no origin) is the site's home or below it. */
export function isWithinSite(base: string, path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (base === "") return true;
  return path === base || (path.startsWith(base) && /^[/?#]/.test(path.slice(base.length)));
}
