"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, cn, FormMessage, Input, SubmitButton } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { ACCENT_PRESETS, normalizeHexColor, SITE_STYLE_LIST, SITE_STYLES, type SiteStyleId } from "@/lib/site-styles";
import { sitePath } from "@/lib/site-paths";

const DESKTOP_WIDTH = 1280;
const PHONE_WIDTH = 390;

function previewUrl(siteBase: string, style: SiteStyleId, accent?: string) {
  const qs = new URLSearchParams({ style, embed: "1" });
  if (accent) qs.set("accent", accent);
  return `${sitePath(siteBase)}?${qs}`;
}

/** A scaled-down live render of the couple's own site in one style. */
function Thumbnail({ siteBase, style }: { siteBase: string; style: SiteStyleId }) {
  const scale = 0.25;
  return (
    <div className="relative h-[200px] overflow-hidden rounded-t-[var(--radius-card)] border-b border-line bg-sunken">
      <iframe
        src={previewUrl(siteBase, style)}
        title={`${SITE_STYLES[style].name} preview`}
        loading="lazy"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 origin-top-left"
        style={{ width: DESKTOP_WIDTH, height: 200 / scale, transform: `scale(${scale})` }}
      />
    </div>
  );
}

/** Full preview that fits its column (desktop) or shows a phone-width page. */
function LargePreview({ src, device }: { src: string; device: "desktop" | "phone" }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const height = 640;
  if (device === "phone") {
    return (
      <div ref={box} className="flex justify-center rounded-[var(--radius-card)] bg-sunken py-6">
        <iframe src={src} title="Phone preview" className="rounded-2xl border-4 border-ink bg-surface" style={{ width: PHONE_WIDTH, height }} />
      </div>
    );
  }
  const scale = Math.min(1, width / DESKTOP_WIDTH);
  return (
    <div ref={box} className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken" style={{ height }}>
      <iframe
        src={src}
        title="Desktop preview"
        className="absolute top-0 left-0 origin-top-left bg-surface"
        style={{ width: DESKTOP_WIDTH, height: height / scale, transform: `scale(${scale})` }}
      />
    </div>
  );
}

export function DesignSettings({
  siteBase,
  savedStyle,
  savedAccent,
  action,
}: {
  siteBase: string;
  savedStyle: SiteStyleId;
  savedAccent: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [style, setStyle] = useState<SiteStyleId>(savedStyle);
  const [accent, setAccent] = useState(savedAccent);
  const [hexInput, setHexInput] = useState(savedAccent);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const spec = SITE_STYLES[style];
  const dirty = style !== savedStyle || accent !== savedAccent;

  const pickStyle = (id: SiteStyleId) => {
    setStyle(id);
    // Each style comes with its own colour; choosing a style starts from it.
    setAccent(SITE_STYLES[id].defaultAccent);
    setHexInput(SITE_STYLES[id].defaultAccent);
  };
  const pickAccent = (hex: string) => {
    setAccent(hex);
    setHexInput(hex);
  };
  const swatches = [
    { name: `${spec.name} default`, hex: spec.defaultAccent },
    ...ACCENT_PRESETS.filter((p) => p.hex !== spec.defaultAccent),
  ];

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="style" value={style} />
      <input type="hidden" name="accentColor" value={accent} />
      <FormMessage state={state} />

      <section aria-labelledby="styles-heading" className="space-y-3">
        <div>
          <h2 id="styles-heading" className="text-base font-semibold text-ink">
            Style
          </h2>
          <p className="text-sm text-ink-muted">
            Each style changes your website’s layout, fonts and colours. These previews show your own pages.
          </p>
        </div>
        <div role="radiogroup" aria-labelledby="styles-heading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SITE_STYLE_LIST.map((s) => {
            const selected = s.id === style;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickStyle(s.id)}
                className={cn(
                  "overflow-hidden rounded-[var(--radius-card)] border-2 bg-surface text-left transition-colors",
                  selected ? "border-brand" : "border-line hover:border-line-strong",
                )}
              >
                <Thumbnail siteBase={siteBase} style={s.id} />
                <div className="space-y-1 px-4 py-3">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    {s.name}
                    {s.id === savedStyle && <span className="text-xs font-normal text-ink-muted">· current</span>}
                  </p>
                  <p className="text-sm text-ink-muted">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader title="Colour" description={`Used for links, buttons and highlights. ${spec.name} suggests ${spec.defaultAccentName.toLowerCase()}.`} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
            {swatches.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                role="radio"
                aria-checked={accent === sw.hex}
                aria-label={sw.name}
                title={sw.name}
                onClick={() => pickAccent(sw.hex)}
                className={cn("size-9 rounded-full border-2 ring-offset-2 ring-offset-surface", accent === sw.hex ? "border-surface ring-2 ring-ink" : "border-surface")}
                style={{ backgroundColor: sw.hex }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1.5 text-sm">
              <span className="block font-medium text-ink">Custom colour</span>
              <Input
                value={hexInput}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  const hex = normalizeHexColor(e.target.value);
                  if (hex) setAccent(hex);
                }}
                placeholder="#7c5c3e"
                className="w-36 font-mono"
                invalid={!!state?.errors?.accentColor || !normalizeHexColor(hexInput)}
              />
            </label>
            <Button variant="ghost" size="sm" onClick={() => pickAccent(spec.defaultAccent)} disabled={accent === spec.defaultAccent}>
              Reset to style default
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Preview: ${spec.name}`}
          description="Scroll and click around — this is your real site with the design above."
          actions={
            <div className="flex rounded-lg border border-control p-0.5" role="group" aria-label="Preview size">
              {(["desktop", "phone"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={device === d}
                  onClick={() => setDevice(d)}
                  className={cn("rounded-md px-3 py-1 text-sm capitalize", device === d ? "bg-brand text-white" : "text-ink-muted hover:text-ink")}
                >
                  {d}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          <LargePreview key={device} src={previewUrl(siteBase, style, accent)} device={device} />
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <SubmitButton disabled={!dirty} pendingLabel="Saving…">
          Use this design
        </SubmitButton>
        {dirty ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStyle(savedStyle);
              pickAccent(savedAccent);
            }}
          >
            Undo changes
          </Button>
        ) : (
          <span className="text-sm text-ink-muted">This is your current design.</span>
        )}
      </div>
    </form>
  );
}
