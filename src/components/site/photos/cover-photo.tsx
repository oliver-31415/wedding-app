import type { SitePhoto } from "@/lib/photos-shared";
import type { SiteStyleId } from "@/lib/site-styles";
import { SitePhotoImg } from "./site-photo";

/**
 * Renders a top-of-page photo (the cover photo on Home, or a page's own photo
 * on subpages), framed according to the active site style. Never rendered for
 * the Split style (which renders the photo in the sticky left panel) or inside
 * SiteShell for the other five styles, so page visibility rules always apply.
 */
export function CoverPhoto({
  photo,
  partnerOne,
  partnerTwo,
  fallbackAlt,
  styleId,
}: {
  photo: SitePhoto;
  partnerOne: string;
  partnerTwo: string;
  /** Used when photo.alt is blank; defaults to couple's names (Home cover). Pass "" on subpages where the adjacent <h1> names the page. */
  fallbackAlt?: string;
  styleId: SiteStyleId;
}) {
  if (styleId === "split") return null;

  const alt = photo.alt?.trim() || (fallbackAlt !== undefined ? fallbackAlt : `${partnerOne} & ${partnerTwo}`);

  if (styleId === "modern") {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken sm:aspect-[16/9]">
          <SitePhotoImg photo={photo} alt={alt} priority />
        </div>
      </div>
    );
  }

  if (styleId === "garden") {
    return (
      <div className="mx-auto max-w-[20rem] sm:max-w-md">
        <div className="rounded-t-full rounded-b-[var(--radius-card)] bg-surface p-2.5 shadow-[0_6px_24px_-10px_color-mix(in_srgb,var(--color-ink)_10%,transparent)] ring-1 ring-line/80">
          <div className="aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[calc(var(--radius-card)-6px)] bg-sunken">
            <SitePhotoImg photo={photo} alt={alt} priority />
          </div>
        </div>
      </div>
    );
  }

  if (styleId === "editorial") {
    return (
      <div className="max-w-lg">
        <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken">
          <SitePhotoImg photo={photo} alt={alt} priority />
        </div>
      </div>
    );
  }

  if (styleId === "minimal") {
    return (
      <div className="mx-auto max-w-md">
        <div className="aspect-[4/3] overflow-hidden rounded-none border border-line bg-sunken">
          <SitePhotoImg photo={photo} alt={alt} priority />
        </div>
      </div>
    );
  }

  // Classic: centred framed print above welcome text.
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-2 sm:p-3.5">
        <div className="aspect-[4/3] overflow-hidden rounded-[calc(var(--radius-card)-4px)] bg-sunken sm:aspect-[3/2]">
          <SitePhotoImg photo={photo} alt={alt} priority />
        </div>
      </div>
    </div>
  );
}
