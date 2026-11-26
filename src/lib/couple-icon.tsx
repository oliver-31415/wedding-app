import "server-only";
import { ImageResponse } from "next/og";
import { coupleInitials, normalizeHexColor, pickAccentInk, readableAccent } from "@/lib/site-styles";

/** The browser-tab icon: the couple's initials on a circle of their accent colour. */
export const ICON_SIZE = { width: 64, height: 64 };

export function coupleIcon(
  couple: { partnerOne: string; partnerTwo: string; accentColor: string } | null,
): ImageResponse {
  // Without a wedding (signed out, or an unknown site) it's a plain pink circle.
  const accent = normalizeHexColor(couple?.accentColor) ?? "#b03f68";
  // Pale accents (pastel pink) get initials in a deeper shade of the same colour; dark ones get white.
  const ink = pickAccentInk(accent) === "#ffffff" ? "#ffffff" : readableAccent(accent, [accent]);
  const [one, two] = couple ? coupleInitials(couple.partnerOne, couple.partnerTwo) : ["", ""];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: accent,
          color: ink,
          fontSize: 32,
          // The bundled font only comes in regular: a thin outline keeps it legible at tab size.
          WebkitTextStroke: `1.5px ${ink}`,
          letterSpacing: -1,
        }}
      >
        {one}
        <span style={{ fontSize: 20, margin: "0 1px" }}>&amp;</span>
        {two}
      </div>
    ),
    ICON_SIZE,
  );
}
