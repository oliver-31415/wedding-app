import { describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  buildSiteStyleVars,
  contrastRatio,
  firstSearchParam,
  getSiteStyle,
  isValidSiteStyle,
  normalizeHexColor,
  pickAccentInk,
  resolveSiteStyle,
  SITE_STYLE_IDS,
  SITE_STYLE_LIST,
  SITE_STYLES,
} from "./site-styles";

describe("site style presets", () => {
  it("defines 5 distinct presets including existing classic, modern, and garden ids", () => {
    expect(SITE_STYLE_IDS).toEqual(["classic", "modern", "garden", "editorial", "minimal"]);
    expect(SITE_STYLE_LIST).toHaveLength(5);

    const headers = new Set(SITE_STYLE_LIST.map((s) => s.layout.header));
    const navs = new Set(SITE_STYLE_LIST.map((s) => s.layout.nav));
    const schedules = new Set(SITE_STYLE_LIST.map((s) => s.layout.schedule));
    const parties = new Set(SITE_STYLE_LIST.map((s) => s.layout.party));
    const faqs = new Set(SITE_STYLE_LIST.map((s) => s.layout.faq));
    const contentTreatments = new Set(SITE_STYLE_LIST.map((s) => s.layout.content));

    expect(headers.size).toBe(5);
    expect(navs.size).toBe(5);
    expect(schedules.size).toBe(5);
    expect(parties.size).toBe(5);
    expect(faqs.size).toBe(5);
    expect(contentTreatments.size).toBe(5);
  });

  it("validates style ids and falls back to classic for unknown values", () => {
    for (const id of SITE_STYLE_IDS) {
      expect(isValidSiteStyle(id)).toBe(true);
      expect(getSiteStyle(id).id).toBe(id);
    }
    expect(isValidSiteStyle("vintage")).toBe(false);
    expect(isValidSiteStyle(null)).toBe(false);
    expect(getSiteStyle("unknown").id).toBe("classic");
    expect(getSiteStyle(undefined).id).toBe("classic");
    expect(getSiteStyle("").id).toBe("classic");
  });

  it("validates 6-digit hex colours", () => {
    expect(normalizeHexColor("#7C5C3E")).toBe("#7c5c3e");
    expect(normalizeHexColor("  #355E3B ")).toBe("#355e3b");
    expect(normalizeHexColor("#fff")).toBeNull();
    expect(normalizeHexColor("7c5c3e")).toBeNull();
    expect(normalizeHexColor("#zzzzzz")).toBeNull();
    expect(normalizeHexColor(null)).toBeNull();
  });
});

describe("WCAG AA accessibility contrast (>= 4.5:1)", () => {
  it("passes 4.5:1 text contrast for every palette across canvas, surface, sunken, and accent", () => {
    for (const style of SITE_STYLE_LIST) {
      const { palette, defaultAccent } = style;
      // Primary, muted, and faint inks on canvas and surface
      expect(contrastRatio(palette.ink, palette.canvas), `${style.id} ink/canvas`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.ink, palette.surface), `${style.id} ink/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.ink, palette.sunken), `${style.id} ink/sunken`).toBeGreaterThanOrEqual(4.5);

      expect(contrastRatio(palette.inkMuted, palette.canvas), `${style.id} inkMuted/canvas`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.inkMuted, palette.surface), `${style.id} inkMuted/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.inkMuted, palette.sunken), `${style.id} inkMuted/sunken`).toBeGreaterThanOrEqual(4.5);

      expect(contrastRatio(palette.inkFaint, palette.canvas), `${style.id} inkFaint/canvas`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.inkFaint, palette.surface), `${style.id} inkFaint/surface`).toBeGreaterThanOrEqual(4.5);

      // Default accent for links on canvas & surface, and button ink on accent
      expect(contrastRatio(defaultAccent, palette.canvas), `${style.id} accent/canvas`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(defaultAccent, palette.surface), `${style.id} accent/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.accentInk, defaultAccent), `${style.id} accentInk/accent`).toBeGreaterThanOrEqual(4.5);
      expect(pickAccentInk(defaultAccent)).toBe(palette.accentInk);
    }
  });

  it("ensures all curated accent presets pass 4.5:1 on white and with white text", () => {
    for (const preset of ACCENT_PRESETS) {
      expect(contrastRatio(preset.hex, "#ffffff"), `${preset.name} on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio("#ffffff", preset.hex), `white on ${preset.name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("picks accessible foreground ink for both light and dark custom accents", () => {
    expect(pickAccentInk("#171717")).toBe("#ffffff");
    expect(pickAccentInk("#7c5c3e")).toBe("#ffffff");
    expect(pickAccentInk("#f5d76e")).toBe("#111111");
    expect(contrastRatio(pickAccentInk("#f5d76e"), "#f5d76e")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("resolveSiteStyle & host preview overrides", () => {
  it("ignores ?style, ?accent, and ?embed when viewer is not a host", () => {
    const res = resolveSiteStyle({
      savedTheme: "classic",
      savedAccent: "#7c5c3e",
      queryStyle: "editorial",
      queryAccent: "#1e40af",
      queryEmbed: "1",
      isHost: false,
    });
    expect(res.style.id).toBe("classic");
    expect(res.accent).toBe("#7c5c3e");
    expect(res.isPreviewOverride).toBe(false);
    expect(res.isEmbeddedPreview).toBe(false);
  });

  it("honours ?style for hosts and uses that style's default accent when ?accent is omitted", () => {
    const res = resolveSiteStyle({
      savedTheme: "classic",
      savedAccent: "#7c5c3e",
      queryStyle: "garden",
      queryEmbed: "1",
      isHost: true,
    });
    expect(res.style.id).toBe("garden");
    expect(res.accent).toBe(SITE_STYLES.garden.defaultAccent);
    expect(res.isPreviewOverride).toBe(true);
    expect(res.isEmbeddedPreview).toBe(true);
  });

  it("keeps saved accent when host previews their current saved style without ?accent", () => {
    const res = resolveSiteStyle({
      savedTheme: "classic",
      savedAccent: "#35526c",
      queryStyle: "classic",
      isHost: true,
    });
    expect(res.style.id).toBe("classic");
    expect(res.accent).toBe("#35526c");
    expect(res.isPreviewOverride).toBe(false);
  });

  it("honours explicit ?accent for hosts and ignores invalid query values", () => {
    const custom = resolveSiteStyle({
      savedTheme: "classic",
      savedAccent: "#7c5c3e",
      queryStyle: "modern",
      queryAccent: "#7A2E3A",
      isHost: true,
    });
    expect(custom.style.id).toBe("modern");
    expect(custom.accent).toBe("#7a2e3a");
    expect(custom.isPreviewOverride).toBe(true);

    const invalid = resolveSiteStyle({
      savedTheme: "garden",
      savedAccent: "#355e3b",
      queryStyle: "nope",
      queryAccent: "not-a-color",
      isHost: true,
    });
    expect(invalid.style.id).toBe("garden");
    expect(invalid.accent).toBe("#355e3b");
    expect(invalid.isPreviewOverride).toBe(false);
  });
});

describe("buildSiteStyleVars & firstSearchParam", () => {
  it("sets Tailwind token CSS variables to match the resolved preset", () => {
    const vars = buildSiteStyleVars({
      style: SITE_STYLES.editorial,
      accent: "#7a2e3a",
      accentInk: "#ffffff",
    }) as Record<string, string>;

    expect(vars["--color-canvas"]).toBe(SITE_STYLES.editorial.palette.canvas);
    expect(vars["--color-surface"]).toBe(SITE_STYLES.editorial.palette.surface);
    expect(vars["--color-ink"]).toBe(SITE_STYLES.editorial.palette.ink);
    expect(vars["--color-accent"]).toBe("#7a2e3a");
    expect(vars["--color-accent-ink"]).toBe("#ffffff");
    expect(vars["--font-serif"]).toBe(SITE_STYLES.editorial.fonts.heading);
    expect(vars["--font-sans"]).toBe(SITE_STYLES.editorial.fonts.body);
    expect(vars["--radius-card"]).toBe(SITE_STYLES.editorial.layout.cardRadius);
  });

  it("extracts the first search param cleanly", () => {
    expect(firstSearchParam("modern")).toBe("modern");
    expect(firstSearchParam(["garden", "minimal"])).toBe("garden");
    expect(firstSearchParam(undefined)).toBeNull();
  });
});
