import { cn } from "@/components/ui";

/**
 * A gift's picture, letterboxed (never cropped) on a neutral square so
 * product shots of any shape line up. Renders nothing without a picture.
 * Plain <img>: pictures are our own /uploads files and the image optimiser
 * (sharp) isn't installed.
 */
export function GiftPicture({
  src,
  alt,
  size = "card",
  muted = false,
}: {
  src: string | null | undefined;
  alt: string;
  size?: "card" | "thumb";
  muted?: boolean;
}) {
  if (!src) return null;
  return (
    <div
      className={cn(
        "overflow-hidden border border-line bg-white",
        size === "card" ? "aspect-square w-full rounded-[var(--radius-card)]" : "size-16 shrink-0 rounded-lg",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("h-full w-full object-contain p-2", muted && "opacity-60 grayscale-[40%]")}
      />
    </div>
  );
}
