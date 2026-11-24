"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/components/ui";
import type { SitePhoto } from "@/lib/photos-shared";
import type { SiteStyleId } from "@/lib/site-styles";
import { PhotoLightbox } from "./photo-lightbox";
import { SitePhotoImg } from "./site-photo";

function triggerLabel(photo: SitePhoto, index: number, total: number) {
  const base = `View photo ${index + 1} of ${total}`;
  const detail = photo.alt?.trim() || photo.caption?.trim();
  return detail ? `${base}: ${detail}` : base;
}

function galleryAlt(photo: SitePhoto) {
  return photo.alt?.trim() || photo.caption?.trim() || "";
}

/**
 * Curated Photos page grid, styled per preset, with native <dialog> lightbox.
 * Renders nothing when empty (opt-in rule — never placeholders).
 */
export function PhotoGallery({
  photos,
  styleId,
}: {
  photos: SitePhoto[];
  styleId: SiteStyleId;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openPhoto = (index: number, button: HTMLButtonElement) => {
    lastTriggerRef.current = button;
    setActiveIndex(index);
  };

  const handleClose = useCallback(() => {
    setActiveIndex(null);
    const trigger = lastTriggerRef.current;
    lastTriggerRef.current = null;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
  }, []);

  if (photos.length === 0) return null;

  const hoverScale =
    "transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100";

  let grid;

  if (styleId === "modern") {
    grid = (
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-x-3 sm:gap-y-6 md:grid-cols-3">
        {photos.map((photo, i) => (
          <figure key={photo.id} className="min-w-0">
            <button
              type="button"
              onClick={(e) => openPhoto(i, e.currentTarget)}
              aria-label={triggerLabel(photo, i, photos.length)}
              className="group block aspect-square w-full cursor-pointer overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken"
            >
              <SitePhotoImg photo={photo} alt={galleryAlt(photo)} className={hoverScale} />
            </button>
            {photo.caption && (
              <figcaption className="mt-2 text-left text-xs leading-snug text-ink-muted">
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  } else if (styleId === "garden") {
    grid = (
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        {photos.map((photo, i) => {
          const isWide =
            photos.length === 1 ||
            (photos.length >= 3 && i === 0) ||
            (photos.length >= 3 && i === photos.length - 1 && (photos.length - 1) % 2 === 1);
          return (
            <figure key={photo.id} className={cn("min-w-0", isWide && "sm:col-span-2")}>
              <button
                type="button"
                onClick={(e) => openPhoto(i, e.currentTarget)}
                aria-label={triggerLabel(photo, i, photos.length)}
                className={cn(
                  "group block w-full cursor-pointer overflow-hidden rounded-[var(--radius-card)] bg-sunken",
                  isWide ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[4/3]",
                )}
              >
                <SitePhotoImg photo={photo} alt={galleryAlt(photo)} className={hoverScale} />
              </button>
              {photo.caption && (
                <figcaption className="mt-2.5 text-center text-xs text-ink-muted">
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    );
  } else if (styleId === "editorial") {
    grid = (
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8">
        {photos.map((photo, i) => {
          const isWide = i % 3 === 0 || (i === photos.length - 1 && i % 3 === 1);
          return (
            <figure key={photo.id} className={cn("min-w-0", isWide && "col-span-2")}>
              <button
                type="button"
                onClick={(e) => openPhoto(i, e.currentTarget)}
                aria-label={triggerLabel(photo, i, photos.length)}
                className={cn(
                  "group block w-full cursor-pointer overflow-hidden rounded-[var(--radius-card)] bg-sunken",
                  isWide ? "aspect-[3/2]" : "aspect-[4/5]",
                )}
              >
                <SitePhotoImg photo={photo} alt={galleryAlt(photo)} className={hoverScale} />
              </button>
              <figcaption className="mt-2.5 flex items-baseline gap-2 text-xs text-ink-muted">
                <span className="font-serif text-ink-faint tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {photo.caption && (
                  <>
                    <span aria-hidden="true" className="text-ink-faint">
                      &mdash;
                    </span>
                    <span>{photo.caption}</span>
                  </>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    );
  } else if (styleId === "minimal") {
    grid = (
      <div className="mx-auto max-w-xl space-y-9 sm:space-y-12" data-minimal-gallery="true">
        {photos.map((photo, i) => {
          const ratio = photo.height > 0 ? photo.width / photo.height : 4 / 3;
          return (
            <figure key={photo.id} className="text-center">
              <button
                type="button"
                onClick={(e) => openPhoto(i, e.currentTarget)}
                aria-label={triggerLabel(photo, i, photos.length)}
                style={{
                  aspectRatio: `${photo.width} / ${photo.height}`,
                  maxWidth: `min(100%, calc(var(--minimal-photo-max-h, 65vh) * ${ratio}))`,
                }}
                className="group mx-auto block w-full cursor-pointer overflow-hidden rounded-none border border-line bg-sunken"
              >
                <SitePhotoImg photo={photo} alt={galleryAlt(photo)} fit="contain" />
              </button>
              {photo.caption && (
                <figcaption className="mt-3 text-center text-xs tracking-wide text-ink-muted">
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    );
  } else if (styleId === "split") {
    // Split: clean 2-up gallery grid inside the narrower right column
    // (or a single framed photo when there's only one).
    grid = (
      <div
        className={
          photos.length === 1
            ? "mx-auto max-w-md"
            : "grid grid-cols-2 gap-3 sm:gap-4"
        }
      >
        {photos.map((photo, i) => (
          <figure key={photo.id} className="min-w-0">
            <button
              type="button"
              onClick={(e) => openPhoto(i, e.currentTarget)}
              aria-label={triggerLabel(photo, i, photos.length)}
              className="group block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken"
            >
              <SitePhotoImg photo={photo} alt={galleryAlt(photo)} className={hoverScale} />
            </button>
            {photo.caption && (
              <figcaption className="mt-2 text-center text-xs leading-snug text-ink-muted">
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  } else {
    // Classic: 2-col matted frames with centred caption inside the mat
    // (one photo on its own is centred rather than left in half the row).
    grid = (
      <div
        className={
          photos.length === 1
            ? "mx-auto max-w-xl"
            : "mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6"
        }
      >
        {photos.map((photo, i) => (
          <figure
            key={photo.id}
            className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-2.5"
          >
            <button
              type="button"
              onClick={(e) => openPhoto(i, e.currentTarget)}
              aria-label={triggerLabel(photo, i, photos.length)}
              className="group block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[calc(var(--radius-card)-4px)] bg-sunken"
            >
              <SitePhotoImg photo={photo} alt={galleryAlt(photo)} className={hoverScale} />
            </button>
            {photo.caption && (
              <figcaption className="mt-2.5 px-1 text-center text-xs text-ink-muted">
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    );
  }

  return (
    <>
      {grid}
      <PhotoLightbox
        photos={photos}
        activeIndex={activeIndex}
        onChangeIndex={setActiveIndex}
        onClose={handleClose}
      />
    </>
  );
}
