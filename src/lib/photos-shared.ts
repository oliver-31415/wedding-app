/**
 * Photo rules shared by the admin, the server and the guest site. Photos are
 * curated, not an album: these caps keep them that way (see
 * docs/CONVENTIONS.md). Video is never accepted.
 */
import type { PageType, PhotoKind } from "@/db/schema";

export const PHOTO_CAPS = {
  /** Story milestones that may have a photo (more milestones can be text-only). */
  story: 8,
  /** Wedding-party members that may have a portrait. */
  party: 12,
  /** Photos on the Photos page. */
  gallery: 12,
} as const;

/** Page types whose items can each carry one photo. */
export const ITEM_PHOTO_PAGE_TYPES = ["story", "party"] as const satisfies readonly PageType[];
export type ItemPhotoPageType = (typeof ITEM_PHOTO_PAGE_TYPES)[number];
export const itemPhotoCap = (type: ItemPhotoPageType) => PHOTO_CAPS[type];
export const pageTakesItemPhotos = (type: PageType): type is ItemPhotoPageType =>
  (ITEM_PHOTO_PAGE_TYPES as readonly PageType[]).includes(type);

/**
 * "Which part of the photo matters most", as a 3×3 grid. Values stop short of
 * the edges (20% / 80%) so faces keep some room above them when cropped.
 */
const STOPS = ["20%", "50%", "80%"] as const;
export const FOCUS_OPTIONS: { value: string; label: string }[] = STOPS.flatMap((y, row) =>
  STOPS.map((x, col) => ({
    value: `${x} ${y}`,
    label: `${["Top", "Middle", "Bottom"][row]} ${["left", "centre", "right"][col]}`.replace("Middle centre", "Centre"),
  })),
);
/**
 * Top centre by default: in most wedding photos the faces are in the upper
 * part, and a tall photo cropped into a wide frame otherwise loses the heads.
 * (Wide photos in wide frames barely move.)
 */
export const DEFAULT_FOCUS: Record<PhotoKind | "portrait", string> = {
  cover: "50% 20%",
  item: "50% 20%",
  gallery: "50% 20%",
  portrait: "50% 20%",
};
export const isFocus = (v: string | null | undefined): v is string => !!v && FOCUS_OPTIONS.some((o) => o.value === v);

/** Largest picture the server accepts (the request limit in next.config.ts is a little above). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_ALT = 200;
export const MAX_CAPTION = 200;

/** What the guest site needs to draw a photo without layout jumps. */
export type SitePhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
  /** Null = no description given; components choose a fallback. */
  alt: string | null;
  caption: string | null;
  /** CSS object-position. */
  focus: string;
};
