import { getHostContext } from "@/lib/auth";
import { coupleIcon, ICON_SIZE } from "@/lib/couple-icon";

export const size = ICON_SIZE;
export const contentType = "image/png";

export default async function Icon() {
  const ctx = await getHostContext();
  return coupleIcon(ctx?.wedding ?? null);
}
