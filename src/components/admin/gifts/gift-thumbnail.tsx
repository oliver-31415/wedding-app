import Image from "next/image";
import { cn } from "@/components/ui";

const SIZES = {
  sm: { box: "size-10 rounded-md p-0.5", px: "40px" },
  md: { box: "size-14 sm:size-16 rounded-lg p-1", px: "64px" },
  lg: { box: "size-24 rounded-lg p-1.5", px: "96px" },
} as const;

/**
 * Square product picture thumbnail for admin gift screens.
 * Uses `next/image` with `unoptimized` (sharp is not installed) and `object-contain`
 * so product photos are never cropped.
 */
export function GiftThumbnail({
  src,
  alt,
  size = "md",
  className,
}: {
  src: string;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cfg = SIZES[size];
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden border border-line bg-sunken/40",
        cfg.box,
        className,
      )}
    >
      <div className="relative size-full">
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes={cfg.px}
          className="object-contain"
        />
      </div>
    </div>
  );
}
