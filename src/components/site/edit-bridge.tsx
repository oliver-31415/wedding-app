"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { EDITOR_CHANNEL, type EditorMessage, type PreviewMessage } from "@/lib/edit-targets";

type Unsent<T> = T extends unknown ? Omit<T, "channel"> : never;

/**
 * Runs inside the visual editor's preview iframe (host only, `?edit=1`).
 * Outlines editable parts on hover, turns clicks on them into "open this
 * editor" messages for the parent page, and stops links and forms from doing
 * anything else. Renders nothing; does nothing outside the editor.
 */
export function EditBridge() {
  const router = useRouter();
  const editing = useSearchParams().get("edit") === "1";

  useEffect(() => {
    if (!editing || window.parent === window) return;
    const origin = window.location.origin;
    const send = (m: Unsent<PreviewMessage>) => window.parent.postMessage({ channel: EDITOR_CHANNEL, ...m }, origin);
    document.documentElement.dataset.editing = "true";

    // A floating label naming what a click will edit (kept out of the page's
    // own layout so sticky or absolute elements aren't disturbed).
    const label = document.createElement("div");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;display:none;background:#2563eb;color:#fff;font:500 12px/1 system-ui,sans-serif;padding:6px 8px;border-radius:6px;white-space:nowrap";
    document.body.appendChild(label);
    const onOver = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-edit-target]") : null;
      if (!el) {
        label.style.display = "none";
        return;
      }
      const r = el.getBoundingClientRect();
      label.textContent = `Edit: ${el.dataset.editLabel ?? ""}`;
      label.style.display = "block";
      label.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - label.offsetWidth - 4))}px`;
      label.style.top = `${r.top > 34 ? r.top - 30 : r.top + 6}px`;
    };
    const hideLabel = () => (label.style.display = "none");

    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      const editable = el?.closest<HTMLElement>("[data-edit-target]");
      if (editable) {
        e.preventDefault();
        e.stopPropagation();
        send({ type: "select", target: editable.dataset.editTarget! });
        return;
      }
      const link = el?.closest<HTMLAnchorElement>("a[href]");
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        const url = new URL(link.href, window.location.href);
        if (url.origin === origin) send({ type: "navigate", path: url.pathname });
      }
    };
    // Nothing is sent or changed from the preview: RSVP, gift and password forms are inert.
    const onSubmit = (e: SubmitEvent) => e.preventDefault();
    const onMessage = (e: MessageEvent<EditorMessage>) => {
      if (e.origin !== origin || e.data?.channel !== EDITOR_CHANNEL) return;
      if (e.data.type === "refresh") router.refresh();
      if (e.data.type === "highlight") {
        for (const el of document.querySelectorAll("[data-edit-selected]")) el.removeAttribute("data-edit-selected");
        const target = e.data.target;
        if (!target) return;
        const el = [...document.querySelectorAll<HTMLElement>("[data-edit-target]")].find(
          (n) => n.dataset.editTarget === target,
        );
        if (el) {
          el.setAttribute("data-edit-selected", "true");
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseover", onOver);
    window.addEventListener("scroll", hideLabel, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("message", onMessage);
    send({ type: "ready" });
    return () => {
      delete document.documentElement.dataset.editing;
      label.remove();
      document.removeEventListener("mouseover", onOver);
      window.removeEventListener("scroll", hideLabel, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("message", onMessage);
    };
  }, [editing, router]);

  if (!editing) return null;
  return (
    <style>{`
      html[data-editing] [data-edit-target] { cursor: pointer; outline: 2px dashed transparent; outline-offset: 3px; transition: outline-color .12s; }
      html[data-editing] [data-edit-target]:hover { outline-color: rgb(37 99 235 / .75); }
      html[data-editing] [data-edit-target]:has([data-edit-target]:hover) { outline-color: transparent; }
      html[data-editing] [data-edit-target][data-edit-selected] { outline: 2px solid #2563eb; }
    `}</style>
  );
}
