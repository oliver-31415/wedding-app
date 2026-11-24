"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  buildSiteStyleVars,
  resolveSiteStyle,
  type ResolvedSiteStyle,
} from "@/lib/site-styles";
import { SiteNav, type SiteNavItem } from "./site-nav";

export type SiteShellProps = {
  slug: string;
  partnerOne: string;
  partnerTwo: string;
  subtitle: string;
  published: boolean;
  savedTheme: string;
  savedAccent: string;
  isHost: boolean;
  navItems: SiteNavItem[];
  children: ReactNode;
};

function BotanicalSprig() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 20"
      className="mx-auto mb-4 h-5 w-28 text-accent opacity-75"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <path d="M8 10h36" opacity="0.45" />
      <path d="M76 10h36" opacity="0.45" />
      <path d="M60 17V3" />
      <path d="M60 11c-5-1-9-4-10-8 4 0 8 2 10 6" />
      <path d="M60 11c5-1 9-4 10-8-4 0-8 2-10 6" />
      <path d="M60 14c-4-1-7-3-8-6" opacity="0.65" />
      <path d="M60 14c4-1 7-3 8-6" opacity="0.65" />
    </svg>
  );
}

function buildPreviewQuery(params: {
  style: string | null;
  accent: string | null;
  embed: string | null;
}): string {
  const qs = new URLSearchParams();
  if (params.style) qs.set("style", params.style);
  if (params.accent) qs.set("accent", params.accent);
  if (params.embed === "1") qs.set("embed", "1");
  return qs.toString();
}

function HostPreviewBanner({ resolved }: { resolved: ResolvedSiteStyle }) {
  const { style } = resolved;
  const isMinimal = style.id === "minimal";
  const isModern = style.id === "modern";
  return (
    <div
      className="border-b border-line bg-sunken px-4 py-2 text-center text-xs text-ink"
      style={
        isMinimal
          ? { letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }
          : isModern
            ? { textAlign: "left" }
            : undefined
      }
    >
      <div className={isModern ? "mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-2" : undefined}>
        <span>Preview — only you can see this until you publish. </span>
        <Link
          href="/admin"
          className="font-medium text-accent underline underline-offset-2"
        >
          Back to admin
        </Link>
      </div>
    </div>
  );
}

function UnpublishedScreen({
  partnerOne,
  partnerTwo,
  resolved,
}: {
  partnerOne: string;
  partnerTwo: string;
  resolved: ResolvedSiteStyle;
}) {
  const { style } = resolved;
  const vars = buildSiteStyleVars(resolved);

  const headingClass =
    style.id === "modern"
      ? "font-serif text-3xl font-semibold tracking-tight sm:text-4xl"
      : style.id === "editorial"
        ? "font-serif text-5xl font-normal tracking-tight sm:text-6xl"
        : style.id === "minimal"
          ? "font-serif text-2xl font-normal tracking-[0.06em] sm:text-3xl"
          : style.id === "garden"
            ? "font-serif text-4xl font-normal sm:text-5xl"
            : "font-serif text-4xl font-medium sm:text-5xl";

  return (
    <div
      data-site-style="true"
      data-style={style.id}
      data-content={style.layout.content}
      data-radius={style.layout.radius}
      data-header={style.layout.header}
      style={vars}
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
    >
      {style.id === "garden" && <BotanicalSprig />}
      {style.id === "minimal" && <div className="mb-6 h-px w-10 bg-line-strong" aria-hidden="true" />}
      <h1 className={headingClass}>
        {partnerOne} &amp; {partnerTwo}
      </h1>
      {style.id === "editorial" && (
        <div className="my-5 h-px w-14 bg-accent" aria-hidden="true" />
      )}
      <p className="mt-4 text-sm text-ink-muted">
        This website isn&rsquo;t published yet.
      </p>
      {style.id === "minimal" && <div className="mt-6 h-px w-10 bg-line-strong" aria-hidden="true" />}
    </div>
  );
}

export function SiteShellView({
  slug,
  partnerOne,
  partnerTwo,
  subtitle,
  published,
  isHost,
  navItems,
  resolved,
  previewQuery,
  children,
}: Omit<SiteShellProps, "savedTheme" | "savedAccent"> & {
  resolved: ResolvedSiteStyle;
  previewQuery: string;
}) {
  if (!published && !isHost) {
    return (
      <UnpublishedScreen
        partnerOne={partnerOne}
        partnerTwo={partnerTwo}
        resolved={resolved}
      />
    );
  }

  const { style } = resolved;
  const vars = buildSiteStyleVars(resolved);
  const homeHref = previewQuery ? `/w/${slug}?${previewQuery}` : `/w/${slug}`;
  const showBanner = isHost && !published && !resolved.isEmbeddedPreview;

  const wrapperProps = {
    "data-site-style": "true",
    "data-style": style.id,
    "data-content": style.layout.content,
    "data-radius": style.layout.radius,
    "data-header": style.layout.header,
    style: vars,
  };

  // --------------------------------------------------- 1. Classic (centered)
  if (style.layout.header === "centered") {
    return (
      <div {...wrapperProps} className="flex min-h-screen flex-col">
        {showBanner && <HostPreviewBanner resolved={resolved} />}
        <header className="pt-10 pb-2 text-center sm:pt-14">
          <div className="mx-auto max-w-3xl px-4">
            <Link href={homeHref} className="inline-block">
              <span className="font-serif text-4xl font-medium tracking-normal text-ink sm:text-5xl">
                {partnerOne} &amp; {partnerTwo}
              </span>
            </Link>
            {subtitle && (
              <p className="mt-2.5 text-sm tracking-wide text-ink-muted">{subtitle}</p>
            )}
          </div>
          <SiteNav items={navItems} variant="underline" previewQuery={previewQuery} />
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          {children}
        </main>
      </div>
    );
  }

  // ----------------------------------------------------- 2. Modern (topbar)
  if (style.layout.header === "topbar") {
    return (
      <div {...wrapperProps} className="flex min-h-screen flex-col">
        {showBanner && <HostPreviewBanner resolved={resolved} />}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="min-w-0">
              <Link href={homeHref} className="inline-block">
                <span className="font-serif text-lg font-semibold tracking-tight text-ink sm:text-xl">
                  {partnerOne} &amp; {partnerTwo}
                </span>
              </Link>
              {subtitle && (
                <p className="hidden text-xs tracking-wide text-ink-muted sm:block">
                  {subtitle}
                </p>
              )}
            </div>
            <SiteNav
              items={navItems}
              variant="bar"
              previewQuery={previewQuery}
              mobileSubtitle={subtitle || null}
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          {children}
        </main>
      </div>
    );
  }

  // -------------------------------------------------- 3. Garden (hero-band)
  if (style.layout.header === "hero-band") {
    return (
      <div {...wrapperProps} className="flex min-h-screen flex-col">
        {showBanner && <HostPreviewBanner resolved={resolved} />}
        <header className="border-b border-line bg-sunken px-4 pt-10 pb-8 text-center sm:pt-14 sm:pb-10">
          <div className="mx-auto max-w-3xl">
            <BotanicalSprig />
            <Link href={homeHref} className="inline-block">
              <span className="font-serif text-4xl font-normal tracking-tight text-ink sm:text-6xl">
                {partnerOne}{" "}
                <span className="text-accent italic">&amp;</span>{" "}
                {partnerTwo}
              </span>
            </Link>
            {subtitle && (
              <p className="mt-3 text-sm tracking-wide text-ink-muted sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
          <SiteNav items={navItems} variant="pills" previewQuery={previewQuery} />
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          {children}
        </main>
      </div>
    );
  }

  // --------------------------------------------------- 4. Editorial (split)
  if (style.layout.header === "split") {
    return (
      <div {...wrapperProps} className="flex min-h-screen flex-col">
        {showBanner && <HostPreviewBanner resolved={resolved} />}
        <div className="flex-1 md:grid md:grid-cols-[minmax(16.5rem,23rem)_minmax(0,1fr)]">
          <aside className="border-b border-line bg-sunken/75 px-5 py-7 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-between md:overflow-y-auto md:border-r md:border-b-0 md:px-9 md:py-12">
            <div>
              <div className="flex items-start justify-between gap-4 md:block">
                <Link href={homeHref} className="block">
                  <span className="block font-serif text-3xl leading-[1.06] font-normal tracking-tight text-ink md:text-5xl">
                    <span className="md:block">{partnerOne}</span>{" "}
                    <span className="text-accent italic md:my-0.5 md:block md:text-3xl">&amp;</span>{" "}
                    <span className="md:block">{partnerTwo}</span>
                  </span>
                </Link>
              </div>
              {subtitle && (
                <div className="mt-4 border-t border-line-strong/60 pt-3.5 md:mt-6 md:pt-4">
                  <p className="text-xs leading-relaxed tracking-[0.12em] text-ink-muted uppercase">
                    {subtitle}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 md:mt-10">
              <SiteNav items={navItems} variant="sidebar" previewQuery={previewQuery} />
            </div>
          </aside>

          <main className="min-w-0 px-5 py-9 sm:px-8 md:px-12 md:py-14 lg:px-16">
            <div className="max-w-2xl">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------- 5. Minimal (monogram)
  return (
    <div {...wrapperProps} className="flex min-h-screen flex-col">
      {showBanner && <HostPreviewBanner resolved={resolved} />}
      <header className="px-5 pt-14 pb-6 text-center sm:pt-20 sm:pb-8">
        <div className="mx-auto max-w-xl">
          <Link href={homeHref} className="inline-block">
            <span className="font-serif text-2xl font-normal tracking-[0.06em] text-ink sm:text-3xl">
              {partnerOne} &amp; {partnerTwo}
            </span>
          </Link>
          <div className="mx-auto my-5 h-px w-10 bg-line-strong" aria-hidden="true" />
          {subtitle && (
            <p className="text-[11px] tracking-[0.2em] text-ink-muted uppercase">
              {subtitle}
            </p>
          )}
        </div>
        <SiteNav items={navItems} variant="small-caps" previewQuery={previewQuery} />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}

/**
 * Client shell that reads ?style=, ?accent=, and ?embed= ONLY when `isHost` is
 * true, so hosts can live-preview all 5 presets while guests always see the
 * couple's saved design.
 */
export function SiteShell(props: SiteShellProps) {
  const searchParams = useSearchParams();
  const queryStyle = props.isHost ? searchParams.get("style") : null;
  const queryAccent = props.isHost ? searchParams.get("accent") : null;
  const queryEmbed = props.isHost ? searchParams.get("embed") : null;

  const resolved = resolveSiteStyle({
    savedTheme: props.savedTheme,
    savedAccent: props.savedAccent,
    queryStyle,
    queryAccent,
    queryEmbed,
    isHost: props.isHost,
  });

  const previewQuery = props.isHost
    ? buildPreviewQuery({
        style: queryStyle,
        accent: queryAccent,
        embed: queryEmbed,
      })
    : "";

  return (
    <SiteShellView
      slug={props.slug}
      partnerOne={props.partnerOne}
      partnerTwo={props.partnerTwo}
      subtitle={props.subtitle}
      published={props.published}
      isHost={props.isHost}
      navItems={props.navItems}
      resolved={resolved}
      previewQuery={previewQuery}
    >
      {props.children}
    </SiteShellView>
  );
}
