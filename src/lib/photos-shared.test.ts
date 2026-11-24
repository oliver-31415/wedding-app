import { describe, expect, it } from "vitest";
import { DEFAULT_FOCUS, FOCUS_OPTIONS, isFocus, PHOTO_CAPS, pageTakesItemPhotos } from "./photos-shared";

describe("photo rules", () => {
  it("offers a 3×3 focus grid that stops short of the edges", () => {
    expect(FOCUS_OPTIONS).toHaveLength(9);
    expect(new Set(FOCUS_OPTIONS.map((o) => o.label)).size).toBe(9);
    expect(FOCUS_OPTIONS.map((o) => o.value)).toContain("50% 20%");
    expect(FOCUS_OPTIONS.some((o) => /\b(0|100)%/.test(o.value))).toBe(false);
  });

  it("only accepts focus values from the grid", () => {
    for (const v of Object.values(DEFAULT_FOCUS)) expect(isFocus(v)).toBe(true);
    expect(isFocus("0% 0%")).toBe(false);
    expect(isFocus("50% 20%; background: red")).toBe(false);
    expect(isFocus(null)).toBe(false);
  });

  it("keeps photos to a curated few", () => {
    expect(PHOTO_CAPS).toEqual({ story: 8, party: 12, gallery: 12 });
    expect(pageTakesItemPhotos("story")).toBe(true);
    expect(pageTakesItemPhotos("party")).toBe(true);
    expect(pageTakesItemPhotos("faq")).toBe(false);
  });
});
