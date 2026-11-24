"use server";

import { requireHost } from "@/lib/auth";
import { fail, ok, text, type ActionState } from "@/lib/forms";
import {
  addGalleryPhoto,
  deletePhoto,
  moveGalleryPhoto,
  setCoverPhoto,
  setItemPhoto,
  updatePhotoDetails,
} from "@/lib/photos";
import { revalidateWedding } from "@/lib/revalidate";

/** Photo uploads and edits from the Website editor. Rules live in src/lib/photos.ts. */

const details = (formData: FormData) => ({
  alt: text(formData, "alt"),
  caption: text(formData, "caption"),
  focus: text(formData, "focus"),
});

function uploadedFile(formData: FormData): File | null {
  const f = formData.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function setCoverPhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const file = uploadedFile(formData);
  if (!file) return fail("Choose a photo to upload.", { photo: "Choose a photo to upload." });
  const res = await setCoverPhoto(wedding.id, file, details(formData));
  if (!res.ok) return fail(res.error, { photo: res.error });
  revalidateWedding();
  return ok("Cover photo saved.");
}

export async function setItemPhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const itemId = text(formData, "itemId");
  const file = uploadedFile(formData);
  if (!itemId) return fail("Entry not found.");
  if (!file) return fail("Choose a photo to upload.", { photo: "Choose a photo to upload." });
  const res = await setItemPhoto(wedding.id, itemId, file, details(formData));
  if (!res.ok) return fail(res.error, { photo: res.error });
  revalidateWedding();
  return ok("Photo saved.");
}

export async function addGalleryPhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const pageId = text(formData, "pageId");
  const file = uploadedFile(formData);
  if (!pageId) return fail("Page not found.");
  if (!file) return fail("Choose a photo to upload.", { photo: "Choose a photo to upload." });
  const res = await addGalleryPhoto(wedding.id, pageId, file, details(formData));
  if (!res.ok) return fail(res.error, { photo: res.error });
  revalidateWedding();
  return ok("Photo added.");
}

export async function updatePhotoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { wedding } = await requireHost();
  const photoId = text(formData, "photoId");
  if (!photoId || !(await updatePhotoDetails(wedding.id, photoId, details(formData)))) {
    return fail("That photo no longer exists.");
  }
  revalidateWedding();
  return ok("Photo details saved.");
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const photoId = text(formData, "photoId");
  if (!photoId) return;
  await deletePhoto(wedding.id, photoId);
  revalidateWedding();
}

export async function moveGalleryPhotoAction(formData: FormData): Promise<void> {
  const { wedding } = await requireHost();
  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;
  await moveGalleryPhoto(wedding.id, id, direction);
  revalidateWedding();
}
