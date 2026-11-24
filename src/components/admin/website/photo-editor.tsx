"use client";

import { type ReactNode, useActionState, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGalleryPhotoAction,
  deletePhotoAction,
  moveGalleryPhotoAction,
  setCoverPhotoAction,
  setItemPhotoAction,
  setPagePhotoAction,
  updatePhotoAction,
} from "@/app/admin/website/photo-actions";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  cn,
  ConfirmButton,
  EmptyState,
  Field,
  FormMessage,
  Input,
  Notice,
  ReorderButtons,
  SubmitButton,
} from "@/components/ui";
import { preparePhoto, preparePhotoField } from "@/lib/client-image";
import type { ActionState } from "@/lib/forms";
import {
  DEFAULT_FOCUS,
  FOCUS_OPTIONS,
  MAX_ALT,
  MAX_CAPTION,
  MAX_IMAGE_BYTES,
  PHOTO_CAPS,
  type SitePhoto,
} from "@/lib/photos-shared";

/**
 * Photo controls for the Website editor: the Home page's cover photo, one
 * photo per story milestone / wedding-party member, and the Photos page.
 * Photos are shrunk in the browser before upload (src/lib/client-image.ts).
 */

const ACCEPT = "image/jpeg,image/png,image/webp";
const TOO_BIG = "That photo is too large to upload (5 MB max). Try saving it as a smaller JPEG.";

/**
 * The frames the site's styles crop photos into (src/components/site/photos/),
 * so the focus picker can preview them.
 */
export type CropShape = "wide" | "landscape" | "portrait" | "tall" | "square" | "circle";
const PREVIEW: Record<CropShape, { frame: string; label: string }> = {
  wide: { frame: "aspect-[16/9] rounded-md", label: "Wide" },
  landscape: { frame: "aspect-[4/3] rounded-md", label: "Landscape" },
  portrait: { frame: "aspect-[4/5] rounded-md", label: "Portrait" },
  tall: { frame: "aspect-[3/4] rounded-md", label: "Tall" },
  square: { frame: "aspect-square rounded-md", label: "Square" },
  circle: { frame: "aspect-square rounded-full", label: "Circle" },
};

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// ---------------------------------------------------------------- pieces

/** A 3×3 grid laid over the photo: "which part matters most" when it's cropped. */
function FocusPicker({
  src,
  value,
  onChange,
  crops,
}: {
  src: string;
  value: string;
  onChange: (v: string) => void;
  crops: CropShape[];
}) {
  const name = useId();
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <p className="text-sm text-ink-muted">
        This browser can&apos;t preview that file, so you can&apos;t choose the crop yet. If it doesn&apos;t
        upload, save it as a JPEG first.
      </p>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">Keep in view when cropped</legend>
      <p className="text-sm text-ink-muted">
        Your site&apos;s design crops photos to fit its frames. Pick the part that must always show, like faces.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative w-56 overflow-hidden rounded-lg border border-line bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="block h-auto min-h-24 w-full" onError={() => setBroken(true)} />
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
            {FOCUS_OPTIONS.map((o) => (
              <label key={o.value} className="group relative flex cursor-pointer items-center justify-center">
                <input
                  type="radio"
                  name={name}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                  className="peer sr-only"
                  aria-label={o.label}
                />
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border-2 border-white bg-black/30 shadow-[0_0_0_1px_rgb(0_0_0/0.45)] transition group-hover:bg-white/70 peer-checked:size-5 peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-focus-visible:ring-2 peer-focus-visible:ring-white"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-3">
          {crops.map((shape) => (
            <div key={shape} className="space-y-1">
              <div className={cn("w-24 overflow-hidden border border-line bg-sunken", PREVIEW[shape].frame)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: value }} />
              </div>
              <p className="text-xs text-ink-faint">{PREVIEW[shape].label}</p>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function AltField({ id, defaultValue, error }: { id: string; defaultValue?: string | null; error?: string }) {
  return (
    <Field
      label="Description for screen readers"
      htmlFor={id}
      optional
      hint="Describe what's in the photo for guests who can't see it."
      error={error}
    >
      <Input id={id} name="alt" defaultValue={defaultValue ?? ""} maxLength={MAX_ALT} placeholder="e.g. Sam and Alex laughing on the beach at Kiama" />
    </Field>
  );
}

function CaptionField({ id, defaultValue }: { id: string; defaultValue?: string | null }) {
  return (
    <Field label="Caption" htmlFor={id} optional hint="Shown under the photo.">
      <Input id={id} name="caption" defaultValue={defaultValue ?? ""} maxLength={MAX_CAPTION} placeholder="e.g. Kiama, 2023" />
    </Field>
  );
}

/** Object URL for a chosen file, revoked when it changes or the form goes away. */
function useFilePreview() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the object URL's lifetime
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return { file, url: file ? url : null, setFile };
}

/** Choose a photo, see it, set alt text / focus (and caption), upload. */
function UploadForm({
  action,
  hidden,
  crops,
  defaultFocus,
  withCaption = false,
  submitLabel,
  onCancel,
}: {
  action: Action;
  hidden: Record<string, string>;
  crops: CropShape[];
  defaultFocus: string;
  withCaption?: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const id = useId();
  const { file, url, setFile } = useFilePreview();
  const [focus, setFocus] = useState(defaultFocus);
  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData): Promise<ActionState> => {
    await preparePhotoField(formData, "photo");
    const photo = formData.get("photo");
    const result =
      photo instanceof File && photo.size > MAX_IMAGE_BYTES
        ? { ok: false, message: TOO_BIG, errors: { photo: TOO_BIG } }
        : await action(prev, formData);
    // The browser empties the file field once the form has been sent, so a
    // failed upload starts again from choosing the file.
    if (!result?.ok) setFile(null);
    return result;
  }, null);
  const fieldError = state?.errors?.photo;

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="focus" value={focus} />
      <FormMessage state={state?.ok || fieldError ? null : state} />
      <Field
        label="Photo"
        htmlFor={`${id}-file`}
        hint="JPEG, PNG or WebP. Large photos are made smaller before uploading, and the location your camera saved is removed."
        error={fieldError}
      >
        <input
          id={`${id}-file`}
          type="file"
          name="photo"
          accept={ACCEPT}
          required
          aria-invalid={!!fieldError || undefined}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken"
        />
      </Field>
      {file && url && (
        <>
          <FocusPicker src={url} value={focus} onChange={setFocus} crops={crops} />
          <AltField id={`${id}-alt`} />
          {withCaption && <CaptionField id={`${id}-caption`} />}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingLabel="Uploading…" disabled={!file}>
          {submitLabel}
        </SubmitButton>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** An uploaded photo: edit its description / caption / focus, replace or remove it. */
function SavedPhoto({
  photo,
  crops,
  withCaption = false,
  removeConfirm,
  replace,
  extraActions,
}: {
  photo: SitePhoto;
  crops: CropShape[];
  withCaption?: boolean;
  removeConfirm: string;
  /** Upload form shown by "Replace photo"; omitted for gallery photos. */
  replace?: (close: () => void) => ReactNode;
  extraActions?: ReactNode;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "replace">("view");

  if (mode === "replace" && replace) return <>{replace(() => setMode("view"))}</>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className={cn("w-40 shrink-0 overflow-hidden border border-line bg-sunken", PREVIEW[crops[0]].frame)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.alt ?? ""}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ objectPosition: photo.focus }}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          {withCaption && (
            <p className={photo.caption ? "text-ink" : "text-ink-faint"}>{photo.caption ?? "No caption"}</p>
          )}
          <p className={photo.alt ? "text-ink-muted" : "text-ink-faint"}>
            {photo.alt ? `Description: ${photo.alt}` : "No description for screen readers"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {extraActions}
            {mode === "view" && (
              <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>
                Edit details
              </Button>
            )}
            {replace && mode === "view" && (
              <Button size="sm" variant="secondary" onClick={() => setMode("replace")}>
                Replace photo
              </Button>
            )}
            <form action={deletePhotoAction}>
              <input type="hidden" name="photoId" value={photo.id} />
              <ConfirmButton confirm={removeConfirm}>Remove</ConfirmButton>
            </form>
          </div>
        </div>
      </div>
      {mode === "edit" && (
        <EditDetailsForm photo={photo} crops={crops} withCaption={withCaption} onClose={() => setMode("view")} />
      )}
    </div>
  );
}

/** Mounted only while editing, so closing it drops unsaved changes and old messages. */
function EditDetailsForm({
  photo,
  crops,
  withCaption,
  onClose,
}: {
  photo: SitePhoto;
  crops: CropShape[];
  withCaption: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [state, formAction] = useActionState(updatePhotoAction, null);
  const [focus, setFocus] = useState(photo.focus);
  return (
    <form action={formAction} className="max-w-2xl space-y-4 rounded-lg border border-line p-4">
      <input type="hidden" name="photoId" value={photo.id} />
      <input type="hidden" name="focus" value={focus} />
      <FormMessage state={state} />
      <FocusPicker src={photo.url} value={focus} onChange={setFocus} crops={crops} />
      <AltField id={`${id}-alt`} defaultValue={photo.alt} />
      {withCaption && <CaptionField id={`${id}-caption`} defaultValue={photo.caption} />}
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save details
        </SubmitButton>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- cover

/** Cover and page photos fill wide banners, and the tall photo panel of the Split design. */
const PAGE_CROPS: CropShape[] = ["wide", "square", "tall"];

export function CoverPhotoCard({ photo }: { photo: SitePhoto | null }) {
  const crops = PAGE_CROPS;
  const upload = (onCancel?: () => void) => (
    <UploadForm
      action={setCoverPhotoAction}
      hidden={{}}
      crops={crops}
      defaultFocus={photo?.focus ?? DEFAULT_FOCUS.cover}
      submitLabel={photo ? "Use this photo" : "Add cover photo"}
      onCancel={onCancel}
    />
  );
  return (
    <Card>
      <CardHeader
        title="Cover photo"
        description="The main photo of your site: at the top of your home page, and beside every page that has no photo of its own in the Split design. Leave it out for a text-only front page."
      />
      <CardBody>
        {photo ? (
          <SavedPhoto
            key={photo.id}
            photo={photo}
            crops={crops}
            removeConfirm="Remove the cover photo?"
            replace={(close) => upload(close)}
          />
        ) : (
          upload()
        )}
      </CardBody>
    </Card>
  );
}

export function PagePhotoCard({ pageId, photo }: { pageId: string; photo: SitePhoto | null }) {
  const upload = (onCancel?: () => void) => (
    <UploadForm
      action={setPagePhotoAction}
      hidden={{ pageId }}
      crops={PAGE_CROPS}
      defaultFocus={photo?.focus ?? DEFAULT_FOCUS.page}
      submitLabel={photo ? "Use this photo" : "Add page photo"}
      onCancel={onCancel}
    />
  );
  return (
    <Card>
      <CardHeader
        title="Page photo"
        description="Optional. Shown at the top of this page, or beside it in the Split design (which uses your cover photo when a page has none)."
      />
      <CardBody>
        {photo ? (
          <SavedPhoto
            key={photo.id}
            photo={photo}
            crops={PAGE_CROPS}
            removeConfirm="Remove this page's photo?"
            replace={(close) => upload(close)}
          />
        ) : (
          upload()
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- story / party items

export function ItemPhotoControl({
  itemId,
  itemTitle,
  pageType,
  photo,
  capReached,
}: {
  itemId: string;
  itemTitle: string;
  pageType: "story" | "party";
  photo: SitePhoto | null;
  capReached: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const crops: CropShape[] = pageType === "party" ? ["circle", "tall"] : ["landscape"];
  const defaultFocus = pageType === "party" ? DEFAULT_FOCUS.portrait : DEFAULT_FOCUS.item;
  const noun = pageType === "party" ? "portrait" : "photo";
  const upload = (onCancel: () => void) => (
    <UploadForm
      action={setItemPhotoAction}
      hidden={{ itemId }}
      crops={crops}
      defaultFocus={photo?.focus ?? defaultFocus}
      submitLabel={photo ? `Use this ${noun}` : `Add ${noun}`}
      onCancel={onCancel}
    />
  );

  if (photo) {
    return (
      <SavedPhoto
        key={photo.id}
        photo={photo}
        crops={crops}
        removeConfirm={`Remove the ${noun} for "${itemTitle}"?`}
        replace={(close) => upload(close)}
      />
    );
  }
  if (adding) return upload(() => setAdding(false));
  if (capReached) {
    return (
      <p className="text-sm text-ink-faint">
        {PHOTO_CAPS[pageType]} {noun}s is the most this page can have.
      </p>
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
      Add {noun}
    </Button>
  );
}

// ---------------------------------------------------------------- Photos page

export function GalleryEditor({ pageId, photos }: { pageId: string; photos: SitePhoto[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const room = PHOTO_CAPS.gallery - photos.length;
  const inputId = useId();

  const moveWithAction = async (formData: FormData) => {
    await moveGalleryPhotoAction(formData);
  };

  // Several photos at once: each is shrunk and uploaded in turn.
  function upload(files: File[]) {
    const chosen = files.slice(0, room);
    const skipped = files.length - chosen.length;
    startTransition(async () => {
      const failed: string[] = [];
      for (const [i, file] of chosen.entries()) {
        setProgress(`Uploading ${i + 1} of ${chosen.length}…`);
        try {
          const prepared = await preparePhoto(file);
          if (prepared.size > MAX_IMAGE_BYTES) {
            failed.push(`${file.name}: ${TOO_BIG}`);
            continue;
          }
          const fd = new FormData();
          fd.set("pageId", pageId);
          fd.set("photo", prepared);
          const res = await addGalleryPhotoAction(null, fd);
          if (!res?.ok) failed.push(`${file.name}: ${res?.message ?? "Upload failed."}`);
        } catch {
          failed.push(`${file.name}: the upload didn't go through. Check your connection and try again.`);
        }
      }
      if (skipped > 0) {
        failed.push(`${skipped} more ${skipped === 1 ? "photo wasn't" : "photos weren't"} added: the page holds ${PHOTO_CAPS.gallery}.`);
      }
      setErrors(failed);
      setProgress(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Photos"
        description={`A small, chosen set: up to ${PHOTO_CAPS.gallery}. Guests can tap one to see it larger. ${photos.length} of ${PHOTO_CAPS.gallery} used.`}
      />
      <CardBody className="space-y-5">
        {errors.length > 0 && (
          <Notice tone="bad" title="Some photos weren't added">
            <ul className="list-disc pl-5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Notice>
        )}
        {photos.length === 0 ? (
          <EmptyState title="No photos yet" body="Nothing shows on this page until you add photos." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {photos.map((photo, i) => (
              <li key={photo.id} className="p-4">
                <SavedPhoto
                  photo={photo}
                  crops={["square", "landscape", "portrait"]}
                  withCaption
                  removeConfirm="Remove this photo from the Photos page?"
                  extraActions={
                    <ReorderButtons
                      id={photo.id}
                      action={moveWithAction}
                      isFirst={i === 0}
                      isLast={i === photos.length - 1}
                      label={photo.caption ?? `photo ${i + 1}`}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {room > 0 ? (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-sm font-medium text-ink">
              Add photos
            </label>
            <input
              id={inputId}
              type="file"
              accept={ACCEPT}
              multiple
              disabled={pending}
              aria-describedby={`${inputId}-status`}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) upload(files);
              }}
              className="block w-full text-sm text-ink-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken disabled:opacity-60"
            />
            <p id={`${inputId}-status`} className="text-sm text-ink-muted" role="status">
              {progress ??
                `You can choose several at once (${room} more ${room === 1 ? "fits" : "fit"}). Add captions and descriptions afterwards.`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            This page has {PHOTO_CAPS.gallery} photos, the most it can hold. Remove one to add another.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
