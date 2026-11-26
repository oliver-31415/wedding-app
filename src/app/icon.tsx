import { coupleIcon, ICON_SIZE } from "@/lib/couple-icon";

export const size = ICON_SIZE;
export const contentType = "image/png";

/** Pages outside a wedding (sign in, sign up): a plain circle. Guest sites and admin draw initials. */
export default function Icon() {
  return coupleIcon(null);
}
