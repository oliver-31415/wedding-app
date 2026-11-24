"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { lookupGiftLinkAction, saveGiftItemAction } from "@/app/admin/gifts/actions";
import {
  Button,
  Checkbox,
  Field,
  FormMessage,
  Input,
  LinkButton,
  SubmitButton,
  Textarea,
  cn,
} from "@/components/ui";
import { GiftPicture } from "@/components/site/gifts/gift-picture";
import type { ActionState } from "@/lib/forms";
import {
  GIFT_IMAGE_ACCEPT,
  MAX_GIFT_IMAGE_BYTES,
  MAX_NAME,
  MAX_NOTE,
  MAX_QUANTITY,
  MAX_STORE,
  MAX_URL,
  MIN_QUANTITY,
  centsToInputValue,
  suggestStoreFromUrl,
  type ImageMode,
} from "@/lib/gift-admin/helpers";

export type GiftItemFormData = {
  id: string;
  name: string;
  url: string | null;
  storeName: string | null;
  priceCents: number | null;
  imageUrl: string | null;
  quantityWanted: number;
  mostWanted: boolean;
  note: string | null;
  hidden: boolean;
};

type PictureSource = "upload" | "shop" | "url";

export function GiftItemForm({
  item,
  currency,
}: {
  item?: GiftItemFormData;
  currency: string;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [storeName, setStoreName] = useState(item?.storeName ?? "");
  const [suggestedFromPaste, setSuggestedFromPaste] = useState(false);
  const [price, setPrice] = useState(centsToInputValue(item?.priceCents));
  const [quantityWanted, setQuantityWanted] = useState(String(item?.quantityWanted ?? 1));
  const [mostWanted, setMostWanted] = useState(item?.mostWanted ?? false);
  const [note, setNote] = useState(item?.note ?? "");
  const [hidden, setHidden] = useState(item?.hidden ?? false);

  const [activeSource, setActiveSource] = useState<PictureSource>("upload");
  const [imageMode, setImageMode] = useState<ImageMode>("keep");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [imageLink, setImageLink] = useState("");
  const [clientImageError, setClientImageError] = useState<string | null>(null);
  const [dismissedServerImageError, setDismissedServerImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [looking, startLookup] = useTransition();
  const [lookupMessage, setLookupMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  useEffect(() => {
    if (!previewObjectUrl) return;
    return () => {
      URL.revokeObjectURL(previewObjectUrl);
    };
  }, [previewObjectUrl]);

  function clearSelectedFile() {
    setSelectedFile(null);
    setPreviewObjectUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    setClientImageError(null);
    setDismissedServerImageError(false);
    if (imageMode === "upload" && selectedFile) {
      const attached = formData.get("imageFile");
      if (!(attached instanceof File) || attached.size === 0) {
        formData.set("imageFile", selectedFile);
      }
    }
    const res = await saveGiftItemAction(prev, formData);
    if (res?.ok) {
      setImageMode("keep");
      setActiveSource("upload");
      setImageLink("");
      clearSelectedFile();
    }
    return res;
  }, null);

  const suggestedStore = !storeName.trim() ? suggestStoreFromUrl(url) : null;
  const currentSavedUrl = item?.imageUrl ?? null;
  const linkPreview = imageMode === "url" && /^https?:\/\/\S+$/i.test(imageLink.trim()) ? imageLink.trim() : null;
  const previewSrc =
    imageMode === "upload" && previewObjectUrl
      ? previewObjectUrl
      : linkPreview
        ? linkPreview
        : imageMode !== "remove" && imageMode !== "url"
          ? currentSavedUrl
          : null;
  const imageError =
    clientImageError ?? (dismissedServerImageError ? undefined : state?.errors?.image);

  /**
   * Reads the product page and fills in whatever is still empty: name, store,
   * price and picture (fetched and stored when the gift is saved).
   */
  function fillFromLink(link: string) {
    const target = link.trim();
    if (!target) return;
    setLookupMessage(null);
    startLookup(async () => {
      const res = await lookupGiftLinkAction(target).catch(() => null);
      if (!res?.ok) {
        // Still useful: the store name from the address.
        const host = suggestStoreFromUrl(target);
        if (host && !storeName.trim()) {
          setStoreName(host);
          setSuggestedFromPaste(true);
        }
        setLookupMessage({
          tone: "bad",
          text: `${res?.error ?? "We couldn't read that page."} You can fill in the details yourself.`,
        });
        return;
      }
      const filled: string[] = [];
      if (res.name && !name.trim()) {
        setName(res.name);
        filled.push("name");
      }
      if (res.storeName && !storeName.trim()) {
        setStoreName(res.storeName);
        setSuggestedFromPaste(false);
        filled.push("store");
      }
      if (res.price && !price.trim()) {
        setPrice(res.price);
        filled.push("price");
      }
      const hasPicture = !!selectedFile || (!!currentSavedUrl && imageMode !== "remove");
      if (res.imageUrl && !hasPicture) {
        setActiveSource("url");
        setImageMode("url");
        setImageLink(res.imageUrl);
        setClientImageError(null);
        setDismissedServerImageError(true);
        filled.push("picture");
      }
      const list = filled.length > 1 ? `${filled.slice(0, -1).join(", ")} and ${filled.at(-1)}` : filled[0];
      setLookupMessage(
        filled.length
          ? { tone: "good", text: `Filled in the ${list} from the shop's page. Check them before saving.${res.priceNote ? ` ${res.priceNote}` : ""}` }
          : {
              tone: "bad",
              text: res.priceNote ?? "Nothing new to fill in: we couldn't find more details, or those fields already have something in them.",
            },
      );
    });
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (/^https?:\/\//i.test(pasted)) fillFromLink(pasted);
  }

  function selectSource(next: PictureSource) {
    setActiveSource(next);
    setClientImageError(null);
    setDismissedServerImageError(true);
    if (next === "upload") {
      setImageMode(selectedFile ? "upload" : "keep");
    } else if (next === "shop") {
      clearSelectedFile();
      setImageMode("shop");
    } else {
      clearSelectedFile();
      setImageMode("url");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setClientImageError(null);
    setDismissedServerImageError(true);
    if (!file) {
      clearSelectedFile();
      if (imageMode === "upload") setImageMode("keep");
      return;
    }
    if (file.size > MAX_GIFT_IMAGE_BYTES) {
      clearSelectedFile();
      setClientImageError("That picture is too large (5 MB max).");
      if (imageMode === "upload") setImageMode("keep");
      return;
    }
    setSelectedFile(file);
    setPreviewObjectUrl(URL.createObjectURL(file));
    setImageMode("upload");
  }

  function handleRemovePicture() {
    setClientImageError(null);
    setDismissedServerImageError(true);
    clearSelectedFile();
    setImageLink("");
    setActiveSource("upload");
    setImageMode(currentSavedUrl ? "remove" : "keep");
  }

  function handleKeepCurrentPicture() {
    setClientImageError(null);
    setDismissedServerImageError(true);
    clearSelectedFile();
    setImageLink("");
    setActiveSource("upload");
    setImageMode("keep");
  }

  return (
    <form action={action} className="max-w-2xl space-y-5" noValidate>
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="imageMode" value={imageMode} />
      <FormMessage state={state} />

      <Field
        label="Store link"
        htmlFor="url"
        optional
        hint="Paste a product link (https://…) and we'll fill in the name, price and picture from the shop's page. Guests can use it to view or buy the gift."
        error={state?.errors?.url}
      >
        <div className="flex flex-wrap gap-2">
          <Input
            id="url"
            name="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handleUrlPaste}
            maxLength={MAX_URL}
            placeholder="https://www.davidjones.com/..."
            invalid={!!state?.errors?.url}
            className="min-w-0 flex-1"
          />
          <Button
            variant="secondary"
            onClick={() => fillFromLink(url)}
            disabled={looking || !/^https?:\/\/\S+$/i.test(url.trim())}
          >
            {looking ? "Reading page…" : "Fill in from link"}
          </Button>
        </div>
      </Field>
      <p role="status" aria-live="polite" className={cn("-mt-2 text-sm", lookupMessage?.tone === "bad" ? "text-warn" : "text-good")}>
        {looking ? "Reading the shop's page…" : lookupMessage?.text}
      </p>

      <Field label="Item name" htmlFor="name" error={state?.errors?.name}>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME}
          placeholder="e.g. Le Creuset casserole dish"
          required
          invalid={!!state?.errors?.name}
        />
      </Field>

      <Field
        label="Store name"
        htmlFor="storeName"
        optional
        hint={
          suggestedStore ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>Suggested from link: {suggestedStore}</span>
              <button
                type="button"
                className="font-medium text-brand underline underline-offset-2 hover:text-brand-strong"
                onClick={() => {
                  setStoreName(suggestedStore);
                  setSuggestedFromPaste(false);
                }}
              >
                Use {suggestedStore}
              </button>
            </span>
          ) : suggestedFromPaste ? (
            "Suggested from the link you pasted — edit or clear if you like."
          ) : undefined
        }
        error={state?.errors?.storeName}
      >
        <Input
          id="storeName"
          name="storeName"
          value={storeName}
          onChange={(e) => {
            setStoreName(e.target.value);
            setSuggestedFromPaste(false);
          }}
          maxLength={MAX_STORE}
          placeholder="e.g. David Jones"
          invalid={!!state?.errors?.storeName}
        />
      </Field>

      <fieldset
        className={cn(
          "space-y-4 rounded-xl border bg-sunken/30 p-4",
          imageError ? "border-bad" : "border-line",
        )}
        aria-describedby={imageError ? "picture-error" : undefined}
      >
        <legend className="px-1 text-sm font-medium text-ink">
          Picture
          <span className="ml-1.5 font-normal text-ink-faint">Optional</span>
        </legend>

        {previewSrc && (
          <div className="flex flex-wrap items-center gap-4">
            <GiftPicture
              src={previewSrc}
              alt={name.trim() || "Gift picture preview"}
              size="preview"
              className="bg-surface"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="space-y-0.5 text-sm">
                <p className="truncate font-medium text-ink">
                  {selectedFile ? selectedFile.name : linkPreview ? "Picture from the link" : "Current picture"}
                </p>
                <p className="text-ink-muted">
                  {selectedFile
                    ? "Preview shown — will upload when you save."
                    : linkPreview
                      ? "We'll save our own copy when you save this gift."
                      : imageMode === "shop"
                        ? "Will be replaced when you save."
                        : "Shown on your guest gift list."}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={handleRemovePicture}>
                Remove picture
              </Button>
            </div>
          </div>
        )}

        {imageMode === "remove" && currentSavedUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm">
            <span className="text-ink-muted">Picture will be removed when you save.</span>
            <Button size="sm" variant="ghost" onClick={handleKeepCurrentPicture}>
              Keep picture
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose how to set a picture">
          {(
            [
              { key: "upload", label: "Upload from your device" },
              { key: "shop", label: "Use the picture from the shop link" },
              { key: "url", label: "Paste a picture link" },
            ] as const
          ).map((option) => {
            const active =
              activeSource === option.key &&
              (option.key !== "upload" || imageMode !== "remove");
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => selectSource(option.key)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-lg border px-3 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "border-brand bg-brand-soft font-medium text-brand-strong"
                    : "border-line-strong bg-surface text-ink hover:bg-sunken",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {activeSource === "upload" && (
          <div className="space-y-2">
            <label htmlFor="imageFile" className="sr-only">
              Upload picture from your device
            </label>
            <input
              ref={fileInputRef}
              id="imageFile"
              name="imageFile"
              type="file"
              accept={GIFT_IMAGE_ACCEPT}
              onChange={handleFileChange}
              className="block w-full text-sm text-ink-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-control file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken"
            />
            <p className="text-xs text-ink-muted">
              JPEG, PNG, WebP or GIF, up to 5 MB.
              {!item && url.trim() && !selectedFile
                ? " Leave blank to automatically try fetching a picture from the store link when you add this gift."
                : null}
            </p>
          </div>
        )}

        {activeSource === "shop" && (
          <div className="space-y-2 rounded-lg border border-line bg-surface p-3 text-sm">
            {url.trim() ? (
              <p className="text-ink-muted">
                We&apos;ll fetch the product picture from{" "}
                <span className="font-medium break-all text-ink">{url.trim()}</span> when you save.
              </p>
            ) : (
              <p className="text-ink-muted">
                Enter a store link above first, then save to fetch its picture.
              </p>
            )}
            <button
              type="button"
              onClick={handleKeepCurrentPicture}
              className="text-xs font-medium text-brand underline underline-offset-2 hover:text-brand-strong"
            >
              {currentSavedUrl ? "Keep current picture instead" : "Skip for now"}
            </button>
          </div>
        )}

        {activeSource === "url" && (
          <div className="space-y-2">
            <label htmlFor="imageLink" className="sr-only">
              Picture link
            </label>
            <Input
              id="imageLink"
              name="imageLink"
              type="url"
              value={imageLink}
              onChange={(e) => {
                setImageLink(e.target.value);
                setClientImageError(null);
                setDismissedServerImageError(true);
              }}
              maxLength={MAX_URL}
              placeholder="https://example.com/product-photo.jpg"
              invalid={!!imageError}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <span>Paste a direct link to a JPEG, PNG, WebP or GIF. We&apos;ll store our own copy.</span>
              <button
                type="button"
                onClick={handleKeepCurrentPicture}
                className="font-medium text-brand underline underline-offset-2 hover:text-brand-strong"
              >
                {currentSavedUrl ? "Keep current picture" : "Cancel"}
              </button>
            </div>
          </div>
        )}

        {imageError && (
          <p id="picture-error" role="alert" className="text-sm text-bad">
            {imageError}
          </p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={`Price (${currency})`}
          htmlFor="price"
          optional
          hint="Approximate price to guide guests."
          error={state?.errors?.price}
        >
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 120.00"
            invalid={!!state?.errors?.price}
          />
        </Field>

        <Field
          label="Quantity wanted"
          htmlFor="quantityWanted"
          hint={`Whole number from ${MIN_QUANTITY} to ${MAX_QUANTITY}.`}
          error={state?.errors?.quantityWanted}
        >
          <Input
            id="quantityWanted"
            name="quantityWanted"
            type="number"
            min={MIN_QUANTITY}
            max={MAX_QUANTITY}
            value={quantityWanted}
            onChange={(e) => setQuantityWanted(e.target.value)}
            required
            invalid={!!state?.errors?.quantityWanted}
          />
        </Field>
      </div>

      <Field
        label="Note to guests"
        htmlFor="note"
        optional
        hint="Colour, size, or anything helpful to know before buying."
        error={state?.errors?.note}
      >
        <Textarea
          id="note"
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE}
          placeholder="e.g. Volcanic orange or sage, 26 cm"
          invalid={!!state?.errors?.note}
        />
      </Field>

      <div className="space-y-3 pt-1">
        <Checkbox
          name="mostWanted"
          checked={mostWanted}
          onChange={(e) => setMostWanted(e.target.checked)}
          label="Most wanted"
          hint="Highlights this gift on your guest gift list."
        />
        <Checkbox
          name="hidden"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
          label="Hide from guests"
          hint="Keep this item off your guest gift list without deleting any claims."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton pendingLabel={item ? "Saving…" : "Adding…"}>
          {item ? "Save gift" : "Add gift"}
        </SubmitButton>
        <LinkButton variant="ghost" href="/admin/gifts">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
