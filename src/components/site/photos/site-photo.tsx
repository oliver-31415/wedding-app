import { cn } from "@/components/ui";
import type { SitePhoto } from "@/lib/photos-shared";

/**
 * Plain <img> for curated wedding photos (/uploads/<file>). Uses stored
 * width/height + bg-sunken to avoid layout shift; sharp isn't installed so we
 * intentionally don't use next/image (same pattern as gift-picture.tsx).
 */
export function SitePhotoImg({
  photo,
  alt,
  priority = false,
  fit = "cover",
  focusOverride,
  className,
}: {
  photo: SitePhoto;
  alt: string;
  priority?: boolean;
  fit?: "cover" | "contain";
  focusOverride?: string;
  className?: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={photo.url}
      alt={alt}
      width={photo.width}
      height={photo.height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? undefined : "async"}
      fetchPriority={priority ? "high" : undefined}
      style={fit === "cover" ? { objectPosition: focusOverride ?? photo.focus } : undefined}
      className={cn(
        "block h-full w-full bg-sunken",
        fit === "cover" ? "object-cover" : "object-contain",
        className,
      )}
    />
  );
}
