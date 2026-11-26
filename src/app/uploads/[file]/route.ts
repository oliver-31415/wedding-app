import { CONTENT_TYPE, readUpload } from "@/lib/uploads";

/** Serves stored uploads (gift pictures, photos, sheet music PDFs). File names are random ids, so they're safe to cache forever. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const bytes = await readUpload(file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": CONTENT_TYPE[file.split(".").pop()!],
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
