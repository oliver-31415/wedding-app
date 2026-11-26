import "server-only";
import { ImageResponse } from "next/og";
import { coupleInitials } from "@/lib/site-styles";

/** The browser-tab icon: the couple's initials in rose on a pastel pink circle, whatever the site's accent. */
export const ICON_SIZE = { width: 64, height: 64 };

export function coupleIcon(couple: { partnerOne: string; partnerTwo: string } | null): ImageResponse {
  // Without a wedding (signed out, or an unknown site) it's a plain pink circle.
  const [one, two] = couple ? coupleInitials(couple.partnerOne, couple.partnerTwo) : ["", ""];
  const ink = "#b03f68";
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
          background: "#fbd3de",
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
