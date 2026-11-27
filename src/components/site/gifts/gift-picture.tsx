import { cn } from "@/components/ui";

const SIZES = {
  card: { frame: "aspect-[4/3] w-full rounded-[var(--radius-card)]", pad: "p-3" },
  preview: { frame: "size-24 shrink-0 rounded-lg", pad: "p-1.5" },
  thumb: { frame: "size-16 shrink-0 rounded-lg", pad: "p-1" },
  sm: { frame: "size-10 shrink-0 rounded-md", pad: "p-0.5" },
} as const;

/**
 * A gift's picture, letterboxed (never cropped) so product shots of any shape
 * line up. Renders nothing without a picture.
 * Plain <img>: pictures are our own /uploads files (or client blob: previews)
 * and the image optimiser (sharp) isn't installed.
 */
export function GiftPicture({
  src,
  alt,
  size = "card",
  muted = false,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  muted?: boolean;
  className?: string;
}) {
  if (!src) return null;
  const cfg = SIZES[size];
  return (
    <div
      className={cn(
        "overflow-hidden border border-line bg-sunken/40",
        cfg.frame,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        // A new picture replaces the old one at once, never showing the last product while it loads.
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        // Previews of a shop's picture load from the shop; don't tell it where from.
        referrerPolicy="no-referrer"
        className={cn("h-full w-full object-contain", cfg.pad, muted && "opacity-60 grayscale-[40%]")}
      />
    </div>
  );
}
