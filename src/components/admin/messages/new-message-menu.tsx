"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { createDraftAction } from "@/app/admin/messages/new/actions";
import { MESSAGE_KIND_META, MESSAGE_KIND_ORDER } from "@/lib/messaging/templates";

/**
 * Header action button that opens a chooser for the four message kinds.
 * Each option is a form posting to createDraftAction, so drafts are only
 * created by a deliberate click.
 */
export function NewMessageMenu({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="primary"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        New message
        <span aria-hidden="true" className="text-xs opacity-80">
          ▾
        </span>
      </Button>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-lg ${
            align === "right" ? "left-0 sm:left-auto sm:right-0" : "left-0"
          }`}
        >
          {MESSAGE_KIND_ORDER.map((kind) => {
            const meta = MESSAGE_KIND_META[kind];
            return (
              <form key={kind} action={createDraftAction}>
                <input type="hidden" name="kind" value={kind} />
                <button
                  type="submit"
                  role="menuitem"
                  className="block w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sunken focus:bg-sunken focus:outline-none"
                >
                  <p className="text-sm font-medium text-ink">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{meta.description}</p>
                </button>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
