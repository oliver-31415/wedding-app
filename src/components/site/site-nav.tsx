"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { withPreviewQuery, type SiteNavStyle } from "@/lib/site-styles";

export type SiteNavItem = {
  id: string;
  title: string;
  href: string;
  isHidden?: boolean;
};

function HiddenPill() {
  return (
    <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink-faint uppercase">
      Hidden
    </span>
  );
}

export function SiteNav({
  items,
  variant,
  previewQuery = "",
  mobileSubtitle,
  drawerHeading,
  onPhoto = true,
}: {
  items: SiteNavItem[];
  variant: SiteNavStyle;
  /** Preserves ?style= / ?accent= / ?embed= when hosts navigate inside a live preview. */
  previewQuery?: string;
  /** Optional date/location shown inside the mobile drawer for topbar/split layouts. */
  mobileSubtitle?: string | null;
  /** Optional couple heading shown inside the Split navigation drawer. */
  drawerHeading?: string;
  /** True when the Split MENU pill sits on top of a photo (uses dark scrim pill). */
  onPhoto?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closingForNavRef = useRef(false);

  useEffect(() => {
    if (variant !== "menu-drawer") return;
    const dialog = dialogRef.current;
    if (dialog?.open) {
      closingForNavRef.current = true;
      dialog.close();
    }
  }, [pathname, variant]);

  if (items.length === 0) return null;

  // 0. Split — top-left MENU pill opening an accessible modal navigation drawer
  if (variant === "menu-drawer") {
    const openDrawer = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      closingForNavRef.current = false;
      if (!dialog.open) dialog.showModal();
      setMenuOpen(true);
    };

    const closeDrawer = (forNav = false) => {
      const dialog = dialogRef.current;
      closingForNavRef.current = forNav;
      if (dialog?.open) {
        dialog.close();
      } else {
        setMenuOpen(false);
      }
    };

    const handleDialogClose = () => {
      setMenuOpen(false);
      if (!closingForNavRef.current) {
        triggerRef.current?.focus();
      }
      closingForNavRef.current = false;
    };

    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={openDrawer}
          aria-expanded={menuOpen}
          aria-controls="split-site-nav-dialog"
          aria-haspopup="dialog"
          className={
            onPhoto
              ? "inline-flex min-h-11 items-center gap-2.5 rounded-full border border-white/30 bg-black/60 px-4 text-[11px] font-semibold tracking-[0.18em] text-white uppercase backdrop-blur-md transition-colors hover:bg-black/75"
              : "inline-flex min-h-11 items-center gap-2.5 rounded-full border px-4 text-[11px] font-semibold tracking-[0.18em] uppercase transition-opacity hover:opacity-85"
          }
          style={
            onPhoto
              ? undefined
              : {
                  color: "var(--color-accent-ink)",
                  borderColor: "color-mix(in srgb, var(--color-accent-ink) 35%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--color-accent-ink) 12%, transparent)",
                }
          }
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 18 14"
            className="h-3.5 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M1 2h16M1 7h16M1 12h16" />
          </svg>
          <span>Menu</span>
        </button>

        <dialog
          ref={dialogRef}
          id="split-site-nav-dialog"
          data-split-nav-dialog="true"
          aria-label="Wedding website navigation"
          onClose={handleDialogClose}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer(false);
          }}
          className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(21rem,86vw)] max-w-none overflow-y-auto border-r border-line bg-canvas p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
        >
          <div className="flex min-h-full flex-col p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
              <div className="min-w-0">
                {drawerHeading && (
                  <p className="font-serif text-xl font-normal tracking-tight text-ink">
                    {drawerHeading}
                  </p>
                )}
                {mobileSubtitle && (
                  <p className="mt-1 text-xs tracking-wide text-ink-muted">{mobileSubtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => closeDrawer(false)}
                aria-label="Close navigation menu"
                className="-mt-1.5 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <nav aria-label="Wedding website navigation" className="mt-6 flex-1">
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.id}>
                      <Link
                        href={withPreviewQuery(item.href, previewQuery)}
                        aria-current={active ? "page" : undefined}
                        onClick={() => closeDrawer(true)}
                        className="flex min-h-11 items-center justify-between gap-3 border-l-2 py-2.5 pl-4 text-base transition-colors hover:text-ink"
                        style={{
                          borderColor: active ? "var(--color-accent)" : "transparent",
                          color: active ? "var(--color-accent)" : "var(--color-ink)",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <span className="font-serif text-lg">{item.title}</span>
                        {item.isHidden && <HiddenPill />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </dialog>
      </>
    );
  }

  // 1. Classic — centred underline tabs framed by horizontal rules
  if (variant === "underline") {
    return (
      <nav aria-label="Wedding website navigation" className="mt-6 border-y border-line">
        <ul className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={withPreviewQuery(item.href, previewQuery)}
                  aria-current={active ? "page" : undefined}
                  className="inline-flex items-center gap-1.5 border-b-2 py-0.5 transition-colors"
                  style={{
                    borderColor: active ? "var(--color-accent)" : "transparent",
                    color: active ? "var(--color-accent)" : "var(--color-ink-muted)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span>{item.title}</span>
                  {item.isHidden && <HiddenPill />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  // 2. Modern — right-aligned top bar links on desktop + clean drawer toggle on mobile
  if (variant === "bar") {
    return (
      <nav aria-label="Wedding website navigation" className="relative">
        {/* Desktop horizontal bar */}
        <ul className="hidden items-center gap-x-6 text-sm md:flex">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={withPreviewQuery(item.href, previewQuery)}
                  aria-current={active ? "page" : undefined}
                  className="inline-flex items-center gap-1.5 border-b-2 py-1 whitespace-nowrap transition-colors hover:text-ink"
                  style={{
                    borderColor: active ? "var(--color-accent)" : "transparent",
                    color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span>{item.title}</span>
                  {item.isHidden && <HiddenPill />}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile menu button */}
        <div className="flex justify-end md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="modern-mobile-nav"
            className="inline-flex h-9 items-center gap-2 border border-line-strong px-3 text-xs font-semibold tracking-wider text-ink uppercase transition-colors hover:bg-sunken"
            style={{ borderRadius: "var(--radius-control)" }}
          >
            <span>{menuOpen ? "Close" : "Menu"}</span>
            <span aria-hidden="true" className="text-sm leading-none">
              {menuOpen ? "×" : "≡"}
            </span>
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div
            id="modern-mobile-nav"
            className="fixed inset-x-0 top-[57px] z-40 border-b border-line bg-canvas px-4 py-4 shadow-md md:hidden"
          >
            {mobileSubtitle && (
              <p className="mb-3 border-b border-line pb-2.5 text-xs tracking-wide text-ink-muted uppercase">
                {mobileSubtitle}
              </p>
            )}
            <ul className="space-y-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.id}>
                    <Link
                      href={withPreviewQuery(item.href, previewQuery)}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between border-l-2 py-2.5 pl-3 text-sm transition-colors"
                      style={{
                        borderColor: active ? "var(--color-accent)" : "transparent",
                        color: active ? "var(--color-accent)" : "var(--color-ink)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span>{item.title}</span>
                      {item.isHidden && <HiddenPill />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    );
  }

  // 3. Garden — soft rounded pills
  if (variant === "pills") {
    return (
      <nav aria-label="Wedding website navigation" className="mt-7">
        <ul className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-4 text-sm">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={withPreviewQuery(item.href, previewQuery)}
                  aria-current={active ? "page" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors"
                  style={
                    active
                      ? {
                          backgroundColor: "var(--color-accent)",
                          color: "var(--color-accent-ink)",
                          fontWeight: 500,
                        }
                      : {
                          backgroundColor: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                          color: "var(--color-ink)",
                        }
                  }
                >
                  <span>{item.title}</span>
                  {item.isHidden && (
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                      Hidden
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  // 4. Editorial — vertical sidebar list on desktop, collapsible menu on mobile
  if (variant === "sidebar") {
    return (
      <nav aria-label="Wedding website navigation" className="w-full">
        {/* Desktop vertical list */}
        <ul className="hidden space-y-1.5 md:block">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={withPreviewQuery(item.href, previewQuery)}
                  aria-current={active ? "page" : undefined}
                  className="group flex items-center gap-3 py-1.5 text-sm transition-colors"
                  style={{
                    color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-px shrink-0 transition-all"
                    style={{
                      width: active ? "1.5rem" : "0.75rem",
                      backgroundColor: active ? "var(--color-accent)" : "var(--color-line-strong)",
                    }}
                  />
                  <span className="tracking-wide group-hover:text-ink">{item.title}</span>
                  {item.isHidden && <HiddenPill />}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile menu button + drawer */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="editorial-mobile-nav"
            className="inline-flex h-9 items-center gap-2 border border-line-strong bg-surface/70 px-3.5 text-xs font-medium tracking-[0.14em] text-ink uppercase"
            style={{ borderRadius: "var(--radius-control)" }}
          >
            <span>{menuOpen ? "Close" : "Pages"}</span>
            <span aria-hidden="true">{menuOpen ? "×" : "+"}</span>
          </button>

          {menuOpen && (
            <ul
              id="editorial-mobile-nav"
              className="mt-4 space-y-1 border-t border-line pt-3"
            >
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.id}>
                    <Link
                      href={withPreviewQuery(item.href, previewQuery)}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 py-2 text-sm"
                      style={{
                        color: active ? "var(--color-accent)" : "var(--color-ink)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="h-px w-4 shrink-0"
                        style={{
                          backgroundColor: active ? "var(--color-accent)" : "var(--color-line-strong)",
                        }}
                      />
                      <span>{item.title}</span>
                      {item.isHidden && <HiddenPill />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
    );
  }

  // 5. Minimal — widely tracked uppercase small-caps links
  return (
    <nav aria-label="Wedding website navigation" className="mt-7">
      <ul className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-7 gap-y-2.5 px-4 text-[11px] tracking-[0.2em] uppercase">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.id}>
              <Link
                href={withPreviewQuery(item.href, previewQuery)}
                aria-current={active ? "page" : undefined}
                className="inline-flex items-center gap-1.5 py-1 transition-colors hover:text-ink"
                style={{
                  color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
                  fontWeight: active ? 600 : 400,
                  textDecorationLine: active ? "underline" : "none",
                  textUnderlineOffset: "7px",
                  textDecorationColor: "var(--color-accent)",
                  textDecorationThickness: "1px",
                }}
              >
                <span>{item.title}</span>
                {item.isHidden && <HiddenPill />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
