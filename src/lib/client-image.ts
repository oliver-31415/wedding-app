/**
 * Browser-only. Shrinks a photo before it's uploaded: at most PHOTO_MAX_EDGE
 * pixels on the long side, re-encoded as JPEG. Phone photos are often 5–12 MB
 * and would make the site slow on mobile data; re-encoding also drops the
 * camera's metadata, including where the photo was taken. If the browser
 * can't decode the file (e.g. HEIC in Chrome) it's sent as-is and the server
 * decides.
 */
export const PHOTO_MAX_EDGE = 2000;

export async function preparePhoto(file: File): Promise<File> {
  const looksLikeImage = file.type ? file.type.startsWith("image/") : /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name);
  if (!looksLikeImage || file.type === "image/gif") return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no transparency: put see-through PNGs on white, not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

/** Replaces the named file field in a form's data with its prepared version. */
export async function preparePhotoField(formData: FormData, name: string): Promise<FormData> {
  const file = formData.get(name);
  if (file instanceof File && file.size > 0) formData.set(name, await preparePhoto(file));
  return formData;
}
