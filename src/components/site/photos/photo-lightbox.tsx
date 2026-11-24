"use client";

import { useEffect, useRef } from "react";
import type { SitePhoto } from "@/lib/photos-shared";

/**
 * Full-screen native <dialog> lightbox for the Photos page.
 * Supports Escape (native), ArrowLeft/ArrowRight, horizontal touch swipe,
 * 44px minimum controls, and restores focus to the opener via onClose.
 */
export function PhotoLightbox({
  photos,
  activeIndex,
  onChangeIndex,
  onClose,
}: {
  photos: SitePhoto[];
  activeIndex: number | null;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const photo = activeIndex !== null ? photos[activeIndex] ?? null : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Also closes if the open photo stops existing (removed while viewing),
    // rather than leaving an empty black screen.
    if (photo) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [photo]);

  const hasMultiple = photos.length > 1;

  const goPrev = () => {
    if (activeIndex === null || !hasMultiple) return;
    onChangeIndex((activeIndex - 1 + photos.length) % photos.length);
  };

  const goNext = () => {
    if (activeIndex === null || !hasMultiple) return;
    onChangeIndex((activeIndex + 1) % photos.length);
  };

  return (
    <dialog
      ref={dialogRef}
      data-photo-lightbox="true"
      aria-label="Photo viewer"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/92 p-0 text-white backdrop:bg-black/90"
      onClose={() => onClose()}
      onClick={(e) => {
        if ((e.target as HTMLElement).hasAttribute("data-lightbox-backdrop")) {
          dialogRef.current?.close();
        }
      }}
      onKeyDown={(e) => {
        if (activeIndex === null || !hasMultiple) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goNext();
        }
      }}
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || e.changedTouches.length !== 1 || !hasMultiple) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx < 0) goNext();
          else goPrev();
        }
      }}
    >
      {photo && activeIndex !== null && (
        <div
          data-lightbox-backdrop="true"
          className="relative flex h-full w-full flex-col"
        >
          <div
            data-lightbox-backdrop="true"
            className="flex shrink-0 items-center justify-end px-3 pt-3 sm:px-5 sm:pt-4"
          >
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close photo viewer"
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 motion-reduce:transition-none"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div
            data-lightbox-backdrop="true"
            className="flex min-h-0 flex-1 items-center justify-center px-4 py-2 sm:px-20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.alt?.trim() || photo.caption?.trim() || ""}
              width={photo.width}
              height={photo.height}
              loading="eager"
              decoding="async"
              className="h-auto max-h-[74vh] w-auto max-w-[92vw] bg-white/5 object-contain sm:max-h-[80vh] sm:max-w-[calc(100vw-10rem)]"
            />
          </div>

          <div
            data-lightbox-backdrop="true"
            className="flex shrink-0 flex-col items-center gap-2.5 px-4 pt-2 pb-5 text-center sm:pb-6"
          >
            {photo.caption && (
              <p className="max-w-xl text-sm leading-relaxed text-white/90">
                {photo.caption}
              </p>
            )}
            <div className="flex items-center justify-center gap-4">
              {hasMultiple && (
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous photo"
                  className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 motion-reduce:transition-none sm:absolute sm:top-1/2 sm:left-4 sm:-translate-y-1/2"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
              <p className="text-xs tracking-[0.2em] text-white/75 tabular-nums">
                {activeIndex + 1} / {photos.length}
              </p>
              {hasMultiple && (
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next photo"
                  className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 motion-reduce:transition-none sm:absolute sm:top-1/2 sm:right-4 sm:-translate-y-1/2"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
