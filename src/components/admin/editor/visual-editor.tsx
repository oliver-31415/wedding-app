"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { updateGeneralAction } from "@/app/admin/settings/actions";
import { GeneralDetailsForm, type WeddingGeneralProps } from "@/components/admin/settings/general-forms";
import { PageItemsEditor, type PageItemRow } from "@/components/admin/website/page-items-editor";
import { type PageData, PageSettingsForm } from "@/components/admin/website/page-settings-form";
import { CoverPhotoCard, GalleryEditor, PagePhotoCard } from "@/components/admin/website/photo-editor";
import { Button, buttonClass, Card, CardBody, CardHeader, cn, LinkButton } from "@/components/ui";
import type { PageType } from "@/db/schema";
import {
  decodeTarget,
  EDITOR_CHANNEL,
  type EditorMessage,
  type EditTarget,
  encodeTarget,
  type PreviewMessage,
} from "@/lib/edit-targets";
import type { SitePhoto } from "@/lib/photos-shared";

const DESKTOP_WIDTH = 1440;
const PHONE_WIDTH = 390;

type EditorPage = { id: string; title: string; type: PageType; path: string };
type Unsent<T> = T extends unknown ? Omit<T, "channel"> : never;

/** What can be edited on a page of this type, for the panel's list (and keyboard users). */
function partsFor(page: PageData): { target: EditTarget; label: string; hint: string }[] {
  const parts: { target: EditTarget; label: string; hint: string }[] = [
    { target: { kind: "names" }, label: "Names, date and location", hint: "Shown at the top of every page" },
  ];
  if (page.type === "home") {
    parts.push(
      { target: { kind: "cover" }, label: "Cover photo", hint: "Your site's main photo" },
      { target: { kind: "page", pageId: page.id }, label: "Welcome message", hint: "Title, text and who can see it" },
    );
  } else {
    parts.push(
      { target: { kind: "page", pageId: page.id }, label: "Title and intro text", hint: "And who can see this page" },
      { target: { kind: "page-photo", pageId: page.id }, label: "Page photo", hint: "Optional" },
    );
  }
  if (page.type === "story" || page.type === "party" || page.type === "faq") {
    const label = { story: "Story entries", party: "People", faq: "Questions and answers" }[page.type];
    parts.push({ target: { kind: "items", pageId: page.id }, label, hint: "Add, change, reorder, photos" });
  }
  if (page.type === "photos") parts.push({ target: { kind: "gallery", pageId: page.id }, label: "Photos", hint: "Up to 12" });
  if (page.type === "schedule") parts.push({ target: { kind: "events" }, label: "Events", hint: "Managed in Schedule" });
  if (page.type === "gifts") parts.push({ target: { kind: "gifts" }, label: "Gifts and cash funds", hint: "Managed in Gift list" });
  if (page.type === "rsvp") parts.push({ target: { kind: "rsvp" }, label: "RSVP questions and settings", hint: "Managed in RSVPs" });
  return parts;
}

function ElsewhereNote({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <Card>
      <CardBody className="space-y-3 text-sm text-ink-muted">
        <p>{text}</p>
        <LinkButton href={href} variant="secondary" size="sm">
          {cta}
        </LinkButton>
      </CardBody>
    </Card>
  );
}

/** Measures the preview area so the desktop preview can be scaled to fit. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 900, height: 700 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function VisualEditor({
  renderedAt,
  wedding,
  siteBase,
  pages,
  page,
  tags,
  items,
  coverPhoto,
  pagePhoto,
  itemPhotos,
  galleryPhotos,
}: {
  renderedAt: number;
  wedding: WeddingGeneralProps & { slug: string };
  siteBase: string;
  pages: EditorPage[];
  page: PageData;
  tags: { id: string; name: string }[];
  items: PageItemRow[];
  coverPhoto: SitePhoto | null;
  pagePhoto: SitePhoto | null;
  itemPhotos: Record<string, SitePhoto>;
  galleryPhotos: SitePhoto[];
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const [selected, setSelected] = useState<EditTarget | null>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  // Narrow screens show one side at a time.
  const [mobileView, setMobileView] = useState<"edit" | "preview">("preview");
  const current = pages.find((p) => p.id === page.id)!;
  const previewSrc = `${current.path}${current.path.includes("?") ? "&" : "?"}edit=1&embed=1`;

  const post = useCallback((m: Unsent<EditorMessage>) => {
    frame.current?.contentWindow?.postMessage({ channel: EDITOR_CHANNEL, ...m }, window.location.origin);
  }, []);

  const select = useCallback((target: EditTarget | null) => {
    setSelected(target);
    if (target) setMobileView("edit");
  }, []);

  // Clicks and links inside the preview.
  useEffect(() => {
    const onMessage = (e: MessageEvent<PreviewMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data;
      if (data?.channel !== EDITOR_CHANNEL) return;
      if (data.type === "select") {
        const target = decodeTarget(data.target);
        if (target) select(target);
      } else if (data.type === "navigate") {
        const next = pages.find((p) => p.path === data.path);
        if (next && next.id !== page.id) router.push(`/editor/${next.id}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [pages, page.id, router, select]);

  // After a save the server sends a fresh render: refresh the preview in place.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    post({ type: "refresh" });
  }, [renderedAt, post]);

  // Show what's being edited in the preview.
  useEffect(() => {
    post({ type: "highlight", target: selected ? encodeTarget(selected) : null });
  }, [selected, post]);

  // Jump to the clicked entry in the list.
  useEffect(() => {
    if (selected?.kind === "items" && selected.itemId) {
      document.getElementById(`entry-${selected.itemId}`)?.scrollIntoView({ block: "start" });
    }
  }, [selected]);

  const parts = partsFor(page);
  const selectedLabel = selected ? (parts.find((p) => p.target.kind === selected.kind)?.label ?? "Edit") : null;

  let panel: ReactNode;
  switch (selected?.kind) {
    case "names":
      panel = <GeneralDetailsForm wedding={wedding} action={updateGeneralAction} />;
      break;
    case "page":
      panel = (
        <Card>
          <CardBody>
            <PageSettingsForm page={page} siteBase={siteBase} tags={tags} />
          </CardBody>
        </Card>
      );
      break;
    case "cover":
      panel = <CoverPhotoCard photo={coverPhoto} />;
      break;
    case "page-photo":
      panel = <PagePhotoCard pageId={page.id} photo={pagePhoto} />;
      break;
    case "items":
      panel =
        page.type === "story" || page.type === "party" || page.type === "faq" ? (
          <PageItemsEditor pageId={page.id} pageType={page.type} items={items} photos={itemPhotos} />
        ) : null;
      break;
    case "gallery":
      panel = <GalleryEditor pageId={page.id} photos={galleryPhotos} />;
      break;
    case "events":
      panel = <ElsewhereNote text="Events are shared by the Schedule and RSVP pages, so they're edited in Schedule." href="/admin/schedule" cta="Open Schedule" />;
      break;
    case "gifts":
      panel = <ElsewhereNote text="Gift items and cash funds are managed in the Gift list section." href="/admin/gifts" cta="Open Gift list" />;
      break;
    case "rsvp":
      panel = <ElsewhereNote text="RSVP questions, deadline and settings are managed in the RSVPs section." href="/admin/rsvp" cta="Open RSVPs" />;
      break;
    default:
      panel = (
        <Card>
          <CardHeader title={current.title} description="Click anything outlined in the preview to change it, or pick a part below." />
          <ul className="divide-y divide-line">
            {parts.map((p) => (
              <li key={encodeTarget(p.target)}>
                <button
                  type="button"
                  onClick={() => select(p.target)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">{p.label}</span>
                    <span className="block text-xs text-ink-muted">{p.hint}</span>
                  </span>
                  <span aria-hidden="true" className="text-ink-faint">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      );
  }

  const scale = Math.min(1, area.width / DESKTOP_WIDTH);

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2.5">
        <Link href="/admin/website" className="text-sm text-ink-muted hover:text-ink">
          ← Website
        </Link>
        <label className="sr-only" htmlFor="editor-page">
          Page
        </label>
        <select
          id="editor-page"
          value={page.id}
          onChange={(e) => router.push(`/editor/${e.target.value}`)}
          className="h-9 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-sm font-medium text-ink"
        >
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Preview size" className="hidden rounded-[var(--radius-control)] border border-line-strong p-0.5 lg:flex">
            {(["desktop", "phone"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={cn(
                  "rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-sm capitalize",
                  device === d ? "bg-brand-soft font-medium text-brand-strong" : "text-ink-muted hover:text-ink",
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <Link href={`/admin/website/${page.id}`} className={buttonClass("ghost", "sm")}>
            Form view
          </Link>
          <a href={current.path} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
            View site ↗
          </a>
        </div>
        <div role="group" aria-label="Show" className="flex w-full rounded-[var(--radius-control)] border border-line-strong p-0.5 lg:hidden">
          {(["preview", "edit"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={mobileView === v}
              onClick={() => setMobileView(v)}
              className={cn(
                "flex-1 rounded-[calc(var(--radius-control)-2px)] py-1.5 text-sm capitalize",
                mobileView === v ? "bg-brand-soft font-medium text-brand-strong" : "text-ink-muted",
              )}
            >
              {v === "edit" ? (selectedLabel ?? "Edit") : "Preview"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[27rem_1fr]">
        <aside
          className={cn(
            "min-h-0 space-y-4 overflow-y-auto border-r border-line p-4",
            mobileView === "preview" && "hidden lg:block",
          )}
          aria-label="Editor"
        >
          {selected && (
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-sm font-semibold text-ink">{selectedLabel}</h1>
              <Button size="sm" variant="ghost" onClick={() => select(null)}>
                ← All parts
              </Button>
            </div>
          )}
          {panel}
        </aside>

        <div
          ref={areaRef}
          className={cn("relative min-h-0 overflow-hidden bg-sunken", mobileView === "edit" && "hidden lg:block")}
        >
          {area.width < 640 ? (
            // A phone-sized screen: the preview simply fills it.
            <iframe ref={frame} src={previewSrc} title="Page preview" className="h-full w-full bg-surface" />
          ) : device === "phone" ? (
            <div className="flex h-full justify-center overflow-hidden py-4">
              <iframe
                ref={frame}
                src={previewSrc}
                title="Page preview (phone)"
                className="h-full rounded-[1.75rem] border-[6px] border-ink bg-surface"
                style={{ width: PHONE_WIDTH }}
              />
            </div>
          ) : (
            <iframe
              ref={frame}
              src={previewSrc}
              title="Page preview"
              className="absolute top-0 left-0 origin-top-left bg-surface"
              style={{ width: DESKTOP_WIDTH, height: area.height / scale, transform: `scale(${scale})` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
