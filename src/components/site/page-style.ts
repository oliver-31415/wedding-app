import "server-only";
import type { schema } from "@/db";
import type { Viewer } from "@/lib/site-access";
import { firstSearchParam, resolveSiteStyle, type SiteStyleSpec } from "@/lib/site-styles";

/**
 * The style a page body should render in — the same resolution the site
 * shell uses, so a host previewing `?style=` sees header and content match.
 */
export function pageStyle(
  wedding: Pick<typeof schema.weddings.$inferSelect, "theme" | "accentColor">,
  viewer: Viewer,
  searchParams: Record<string, string | string[] | undefined>,
): SiteStyleSpec {
  return resolveSiteStyle({
    savedTheme: wedding.theme,
    savedAccent: wedding.accentColor,
    queryStyle: firstSearchParam(searchParams.style),
    isHost: viewer.isHost,
  }).style;
}
