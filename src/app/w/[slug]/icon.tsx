import { getWeddingBySlug } from "@/components/site/site-data";
import { coupleIcon, ICON_SIZE } from "@/lib/couple-icon";

export const size = ICON_SIZE;
export const contentType = "image/png";

export default async function Icon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return coupleIcon(await getWeddingBySlug(slug));
}
