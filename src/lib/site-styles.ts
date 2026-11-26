import type { CSSProperties } from "react";

export const SITE_STYLE_IDS = ["classic", "modern", "garden", "editorial", "minimal", "split"] as const;
export type SiteStyleId = (typeof SITE_STYLE_IDS)[number];

export type SiteHeaderLayout = "centered" | "topbar" | "hero-band" | "split" | "monogram" | "split-photo";
export type SiteNavStyle = "underline" | "bar" | "pills" | "sidebar" | "small-caps" | "menu-drawer";
export type SiteContentTreatment = "cards" | "rules" | "soft-panels" | "editorial-cards" | "flat" | "split-clean";
export type SiteScheduleLayout =
  | "cards"
  | "compact-list"
  | "timeline"
  | "editorial-stack"
  | "centered-list"
  | "split-stack";
export type SitePartyLayout =
  | "card-grid"
  | "rule-grid"
  | "soft-grid"
  | "editorial-list"
  | "centered-list"
  | "split-list";
export type SiteFaqLayout =
  | "accordion"
  | "accordion-rules"
  | "soft-accordion"
  | "open-list"
  | "open-centered"
  | "split-accordion";
export type SiteRadius = "md" | "sharp" | "lg" | "sm" | "none";
export type SiteHeadingScale = "classic" | "compact" | "expressive" | "dramatic" | "understated" | "split";

export type SitePalette = {
  canvas: string;
  surface: string;
  sunken: string;
  line: string;
  lineStrong: string;
  control: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  /** Accessible foreground colour for text placed on top of defaultAccent. */
  accentInk: string;
};

export type SiteStyleSpec = {
  id: SiteStyleId;
  name: string;
  description: string;
  layoutSummary: string;
  defaultAccent: string;
  defaultAccentName: string;
  palette: SitePalette;
  /** Tinted paper that takes the hue of a custom accent (see paletteForAccent). */
  tintsToAccent?: boolean;
  fonts: {
    heading: string;
    body: string;
    headingKind: "serif" | "sans";
    headingLabel: string;
    bodyLabel: string;
  };
  layout: {
    header: SiteHeaderLayout;
    nav: SiteNavStyle;
    content: SiteContentTreatment;
    schedule: SiteScheduleLayout;
    party: SitePartyLayout;
    faq: SiteFaqLayout;
    radius: SiteRadius;
    cardRadius: string;
    controlRadius: string;
    headingScale: SiteHeadingScale;
    alignment: "center" | "left";
    maxWidth: "narrow" | "standard" | "wide";
  };
};

export const SITE_STYLES: Record<SiteStyleId, SiteStyleSpec> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Warm paper, centred serif header, underline tabs and bordered cards.",
    layoutSummary: "Centred header · Bordered cards",
    defaultAccent: "#7c5c3e",
    defaultAccentName: "Warm bronze",
    palette: {
      canvas: "#faf8f5",
      surface: "#ffffff",
      sunken: "#f3f0eb",
      line: "#e6e1d9",
      lineStrong: "#cfc7bb",
      control: "#8f867b",
      ink: "#1f1b16",
      inkMuted: "#5e564d",
      inkFaint: "#6e655b",
      accentInk: "#ffffff",
    },
    fonts: {
      heading: "var(--font-serif-display), ui-serif, Georgia, serif",
      body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      headingKind: "serif",
      headingLabel: "Cormorant Garamond",
      bodyLabel: "Inter",
    },
    layout: {
      header: "centered",
      nav: "underline",
      content: "cards",
      schedule: "cards",
      party: "card-grid",
      faq: "accordion",
      radius: "md",
      cardRadius: "0.875rem",
      controlRadius: "0.5rem",
      headingScale: "classic",
      alignment: "center",
      maxWidth: "standard",
    },
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Crisp white top bar with right-aligned navigation, sans headings and sharp rules.",
    layoutSummary: "Top bar · Compact ruled list",
    defaultAccent: "#1e40af",
    defaultAccentName: "Cobalt ink",
    palette: {
      canvas: "#ffffff",
      surface: "#f8f9fa",
      sunken: "#f1f2f5",
      line: "#e2e4e9",
      lineStrong: "#c5c9d2",
      control: "#717680",
      ink: "#111114",
      inkMuted: "#50525b",
      inkFaint: "#636671",
      accentInk: "#ffffff",
    },
    fonts: {
      heading: "var(--font-jakarta), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      headingKind: "sans",
      headingLabel: "Plus Jakarta Sans",
      bodyLabel: "Inter",
    },
    layout: {
      header: "topbar",
      nav: "bar",
      content: "rules",
      schedule: "compact-list",
      party: "rule-grid",
      faq: "accordion-rules",
      radius: "sharp",
      cardRadius: "0.125rem",
      controlRadius: "0.125rem",
      headingScale: "compact",
      alignment: "left",
      maxWidth: "wide",
    },
  },
  garden: {
    id: "garden",
    name: "Garden",
    description: "Soft paper in your colour (sage by default), full-width hero band, pill nav and timeline schedule.",
    layoutSummary: "Hero band · Vertical timeline",
    defaultAccent: "#355e3b",
    defaultAccentName: "Eucalyptus",
    tintsToAccent: true,
    palette: {
      canvas: "#f2f6ef",
      surface: "#fbfdf9",
      sunken: "#e4ece0",
      line: "#d1ddd0",
      lineStrong: "#b3c5b1",
      control: "#6a7d68",
      ink: "#182319",
      inkMuted: "#445345",
      inkFaint: "#516252",
      accentInk: "#ffffff",
    },
    fonts: {
      heading: "var(--font-fraunces), ui-serif, Georgia, serif",
      body: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
      headingKind: "serif",
      headingLabel: "Fraunces",
      bodyLabel: "DM Sans",
    },
    layout: {
      header: "hero-band",
      nav: "pills",
      content: "soft-panels",
      schedule: "timeline",
      party: "soft-grid",
      faq: "soft-accordion",
      radius: "lg",
      cardRadius: "1.5rem",
      controlRadius: "0.75rem",
      headingScale: "expressive",
      alignment: "center",
      maxWidth: "standard",
    },
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "Split-screen sidebar with oversized magazine serif names and open Q&A list.",
    layoutSummary: "Sticky split sidebar · Open Q&A",
    defaultAccent: "#7a2e3a",
    defaultAccentName: "Bordeaux",
    palette: {
      canvas: "#f7f4ee",
      surface: "#ffffff",
      sunken: "#ede7dc",
      line: "#dcd4c6",
      lineStrong: "#c2b7a6",
      control: "#7d7367",
      ink: "#181411",
      inkMuted: "#544c44",
      inkFaint: "#665d54",
      accentInk: "#ffffff",
    },
    fonts: {
      heading: "var(--font-playfair), ui-serif, Georgia, serif",
      body: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
      headingKind: "serif",
      headingLabel: "Playfair Display",
      bodyLabel: "DM Sans",
    },
    layout: {
      header: "split",
      nav: "sidebar",
      content: "editorial-cards",
      schedule: "editorial-stack",
      party: "editorial-list",
      faq: "open-list",
      radius: "sm",
      cardRadius: "0.25rem",
      controlRadius: "0.25rem",
      headingScale: "dramatic",
      alignment: "left",
      maxWidth: "standard",
    },
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Monochrome black-and-white with tracked small-caps nav, thin rules and no cards.",
    layoutSummary: "Narrow centred · No cards",
    defaultAccent: "#171717",
    defaultAccentName: "Obsidian",
    palette: {
      canvas: "#ffffff",
      surface: "#ffffff",
      sunken: "#f4f4f4",
      line: "#e5e5e5",
      lineStrong: "#a3a3a3",
      control: "#737373",
      ink: "#111111",
      inkMuted: "#525252",
      inkFaint: "#666666",
      accentInk: "#ffffff",
    },
    fonts: {
      heading: "var(--font-baskerville), ui-serif, Georgia, serif",
      body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      headingKind: "serif",
      headingLabel: "Libre Baskerville",
      bodyLabel: "Inter",
    },
    layout: {
      header: "monogram",
      nav: "small-caps",
      content: "flat",
      schedule: "centered-list",
      party: "centered-list",
      faq: "open-centered",
      radius: "none",
      cardRadius: "0px",
      controlRadius: "0px",
      headingScale: "understated",
      alignment: "center",
      maxWidth: "narrow",
    },
  },
  split: {
    id: "split",
    name: "Split",
    description: "A large photo beside every page, like a magazine spread.",
    layoutSummary: "Fixed photo · Scrolling column",
    defaultAccent: "#35526c",
    defaultAccentName: "Slate blue",
    palette: {
      canvas: "#f9f8f6",
      surface: "#ffffff",
      sunken: "#f0ede8",
      line: "#e5e0d8",
      lineStrong: "#ccc4b8",
      control: "#877f74",
      ink: "#1c1917",
      inkMuted: "#57524b",
      inkFaint: "#6b655d",
      accentInk: "#ffffff",
    },
    fonts: {
      heading: "var(--font-playfair), ui-serif, Georgia, serif",
      body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      headingKind: "serif",
      headingLabel: "Playfair Display",
      bodyLabel: "Inter",
    },
    layout: {
      header: "split-photo",
      nav: "menu-drawer",
      content: "split-clean",
      schedule: "split-stack",
      party: "split-list",
      faq: "split-accordion",
      radius: "md",
      cardRadius: "0.75rem",
      controlRadius: "0.5rem",
      headingScale: "split",
      alignment: "center",
      maxWidth: "narrow",
    },
  },
};

export const SITE_STYLE_LIST: readonly SiteStyleSpec[] = SITE_STYLE_IDS.map((id) => SITE_STYLES[id]);

export const ACCENT_PRESETS = [
  { name: "Warm bronze", hex: "#7c5c3e" },
  { name: "Cobalt ink", hex: "#1e40af" },
  { name: "Eucalyptus", hex: "#355e3b" },
  { name: "Bordeaux", hex: "#7a2e3a" },
  { name: "Obsidian", hex: "#171717" },
  { name: "Terracotta", hex: "#9b4a32" },
  { name: "Slate blue", hex: "#35526c" },
  { name: "Plum rose", hex: "#824554" },
] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidSiteStyle(value: string | null | undefined): value is SiteStyleId {
  return !!value && (SITE_STYLE_IDS as readonly string[]).includes(value);
}

export function getSiteStyle(value: string | null | undefined): SiteStyleSpec {
  return isValidSiteStyle(value) ? SITE_STYLES[value] : SITE_STYLES.classic;
}

export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

// ------------------------------------------------------------ contrast math

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance for a 6-digit hex colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** WCAG 2.1 contrast ratio (1..21) between two 6-digit hex colours. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Chooses white or near-black foreground text for maximum contrast on `accentHex`. */
export function pickAccentInk(accentHex: string): "#ffffff" | "#111111" {
  const norm = normalizeHexColor(accentHex);
  if (!norm) return "#ffffff";
  return contrastRatio(norm, "#ffffff") >= contrastRatio(norm, "#111111") ? "#ffffff" : "#111111";
}

// ------------------------------------------------------------ accent-derived colours

type Hsl = [number, number, number];

function hexToHsl(hex: string): Hsl {
  const [r, g, b] = parseHexRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToHex([h, s, l]: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The style's palette for this accent. A style with tinted paper (Garden)
 * takes the accent's hue, so a pink accent gets blush paper rather than sage.
 * Its own default accent, and grey accents, keep the palette as designed.
 */
export function paletteForAccent(style: SiteStyleSpec, accent: string): SitePalette {
  const { palette } = style;
  if (!style.tintsToAccent || accent === style.defaultAccent) return palette;
  const [hue, saturation] = hexToHsl(accent);
  if (saturation < 0.12) return palette;
  // Pale paper takes some of the accent's saturation too, so it reads as blush, not grey.
  const tint = (hex: string) => {
    const [, s, l] = hexToHsl(hex);
    return hslToHex([hue, l > 0.8 ? Math.max(s, saturation * 0.6) : s, l]);
  };
  return {
    canvas: tint(palette.canvas),
    surface: tint(palette.surface),
    sunken: tint(palette.sunken),
    line: tint(palette.line),
    lineStrong: tint(palette.lineStrong),
    control: tint(palette.control),
    ink: tint(palette.ink),
    inkMuted: tint(palette.inkMuted),
    inkFaint: tint(palette.inkFaint),
    accentInk: palette.accentInk,
  };
}

/**
 * The accent as a text colour: the chosen colour when it already reads at
 * 4.5:1 on every background, otherwise a deeper shade of the same hue (a
 * pastel pink becomes a rose) so links, headings and the monogram stay legible.
 */
export function readableAccent(accent: string, backgrounds: string[]): string {
  const passes = (hex: string) => backgrounds.every((bg) => contrastRatio(hex, bg) >= 4.5);
  if (passes(accent)) return accent;
  const [h, s, l] = hexToHsl(accent);
  for (let light = Math.min(l, 0.6); light > 0; light -= 0.01) {
    const hex = hslToHex([h, Math.min(s, 0.65), light]);
    if (passes(hex)) return hex;
  }
  return "#111111";
}

/** "B" and "O" for Brendan & Olivia; empty names give an empty initial. */
export function coupleInitials(partnerOne: string, partnerTwo: string): [string, string] {
  const initial = (name: string) => (Array.from(name.trim())[0] ?? "").toLocaleUpperCase();
  return [initial(partnerOne), initial(partnerTwo)];
}

// ------------------------------------------------------------ preview resolution

export type ResolvedSiteStyle = {
  style: SiteStyleSpec;
  accent: string;
  accentInk: "#ffffff" | "#111111";
  isPreviewOverride: boolean;
  /** True when rendered inside the admin design gallery / live preview iframe. */
  isEmbeddedPreview: boolean;
};

/**
 * Resolves which style and accent colour to render for a guest-site request.
 * Query overrides (`?style=`, `?accent=`, `?embed=1`) are ONLY honoured for a
 * signed-in host of this wedding — ordinary guests always see the saved design.
 */
export function resolveSiteStyle(input: {
  savedTheme: string | null | undefined;
  savedAccent: string | null | undefined;
  queryStyle?: string | null;
  queryAccent?: string | null;
  queryEmbed?: string | null;
  isHost: boolean;
}): ResolvedSiteStyle {
  const savedStyle = getSiteStyle(input.savedTheme);
  const savedAccent = normalizeHexColor(input.savedAccent) ?? savedStyle.defaultAccent;

  if (!input.isHost) {
    return {
      style: savedStyle,
      accent: savedAccent,
      accentInk: pickAccentInk(savedAccent),
      isPreviewOverride: false,
      isEmbeddedPreview: false,
    };
  }

  const overrideStyle = isValidSiteStyle(input.queryStyle) ? SITE_STYLES[input.queryStyle] : null;
  const overrideAccent = normalizeHexColor(input.queryAccent);
  const style = overrideStyle ?? savedStyle;

  // When previewing a different style without an explicit ?accent=, show that
  // style's own default accent so gallery previews look authentic.
  let accent: string;
  if (overrideAccent) {
    accent = overrideAccent;
  } else if (overrideStyle && overrideStyle.id !== savedStyle.id) {
    accent = overrideStyle.defaultAccent;
  } else {
    accent = savedAccent;
  }

  const isPreviewOverride =
    (overrideStyle !== null && overrideStyle.id !== savedStyle.id) ||
    (overrideAccent !== null && overrideAccent !== savedAccent);

  return {
    style,
    accent,
    accentInk: pickAccentInk(accent),
    isPreviewOverride,
    isEmbeddedPreview: input.queryEmbed === "1",
  };
}

/**
 * Builds the inline CSS custom properties applied to the guest-site wrapper so
 * Tailwind token classes (bg-surface, text-ink, border-line, bg-accent,
 * text-accent-strong, font-serif, font-sans, rounded-[var(--radius-card)]) resolve
 * to the chosen preset automatically across every guest-site component.
 */
export function buildSiteStyleVars(resolved: Pick<ResolvedSiteStyle, "style" | "accent" | "accentInk">): CSSProperties {
  const { style, accent, accentInk } = resolved;
  const { fonts, layout } = style;
  const palette = paletteForAccent(style, accent);
  const accentStrong = readableAccent(accent, [palette.canvas, palette.surface, palette.sunken]);
  const accentSoft = `color-mix(in srgb, ${accent} 10%, transparent)`;

  return {
    // Tailwind v4 theme tokens
    "--color-canvas": palette.canvas,
    "--color-surface": palette.surface,
    "--color-sunken": palette.sunken,
    "--color-line": palette.line,
    "--color-line-strong": palette.lineStrong,
    "--color-control": palette.control,
    "--color-ink": palette.ink,
    "--color-ink-muted": palette.inkMuted,
    "--color-ink-faint": palette.inkFaint,
    "--color-accent": accent,
    "--color-accent-ink": accentInk,
    "--color-accent-soft": accentSoft,
    // Text in the accent colour (text-accent-strong): a deeper shade when the accent is too pale to read
    "--color-accent-strong": accentStrong,
    // Keep UI-kit controls & focus rings inside the guest site matched to the wedding accent
    "--color-brand": accentStrong,
    "--color-brand-strong": `color-mix(in srgb, ${accentStrong} 84%, black)`,
    "--color-brand-soft": accentSoft,
    // Neutral badges (Child, Plus-one) sit on the style's own grey, not the admin's
    "--color-neutral-soft": palette.sunken,
    "--font-serif": fonts.heading,
    "--font-sans": fonts.body,
    "--radius-card": layout.cardRadius,
    "--radius-control": layout.controlRadius,
    // Legacy aliases
    "--site-canvas": palette.canvas,
    "--site-surface": palette.surface,
    "--site-sunken": palette.sunken,
    "--site-line": palette.line,
    "--site-ink": palette.ink,
    "--site-ink-muted": palette.inkMuted,
    "--site-ink-faint": palette.inkFaint,
    "--site-accent-soft": accentSoft,
    backgroundColor: palette.canvas,
    color: palette.ink,
    fontFamily: fonts.body,
  } as CSSProperties;
}

/** Extract the first string value from a Next.js searchParams entry. */
export function firstSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

/** Preserves host preview query parameters (?style=, ?accent=, ?embed=1) across internal links. */
export function buildPreviewQuery(params: {
  style: string | null;
  accent: string | null;
  embed: string | null;
}): string {
  const qs = new URLSearchParams();
  if (params.style) qs.set("style", params.style);
  if (params.accent) qs.set("accent", params.accent);
  if (params.embed === "1") qs.set("embed", "1");
  return qs.toString();
}

export function withPreviewQuery(href: string, previewQuery: string): string {
  if (!previewQuery) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${previewQuery}`;
}

/**
 * Splits a Home page body into its opening greeting paragraph (shown over the
 * left photo in the Split style) and any additional paragraphs (shown in the
 * right column so longer notes stay readable).
 */
export function splitHomeBody(body: string | null | undefined): {
  lead: string | null;
  rest: string | null;
} {
  const trimmed = body?.trim();
  if (!trimmed) return { lead: null, rest: null };
  const paragraphs = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return { lead: null, rest: null };
  return {
    lead: paragraphs[0],
    rest: paragraphs.length > 1 ? paragraphs.slice(1).join("\n\n") : null,
  };
}
