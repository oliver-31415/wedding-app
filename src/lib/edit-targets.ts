/**
 * The visual editor (/editor/[pageId]) shows the guest site in an iframe with
 * `?edit=1`. Editable parts of the site carry `data-edit-target` (one of the
 * strings below) and `data-edit-label`; clicking one tells the editor which
 * panel to open. Both sides talk with window.postMessage using these shapes.
 */

export type EditTarget =
  /** Couple names, date and location (wedding details). */
  | { kind: "names" }
  /** A page's title, text (the Home page's welcome message) and visibility. */
  | { kind: "page"; pageId: string }
  /** The cover photo (Home). */
  | { kind: "cover" }
  /** A page's own photo. */
  | { kind: "page-photo"; pageId: string }
  /** The entries of a story / wedding party / Q&A page; `itemId` picks one. */
  | { kind: "items"; pageId: string; itemId?: string }
  /** The Photos page's photos. */
  | { kind: "gallery"; pageId: string }
  /** Content managed in other admin sections. */
  | { kind: "events" }
  | { kind: "gifts" }
  | { kind: "rsvp" };

export function encodeTarget(t: EditTarget): string {
  switch (t.kind) {
    case "page":
    case "page-photo":
    case "gallery":
      return `${t.kind}:${t.pageId}`;
    case "items":
      return t.itemId ? `items:${t.pageId}:${t.itemId}` : `items:${t.pageId}`;
    default:
      return t.kind;
  }
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function decodeTarget(raw: unknown): EditTarget | null {
  if (typeof raw !== "string") return null;
  const [kind, a, b] = raw.split(":");
  switch (kind) {
    case "names":
    case "cover":
    case "events":
    case "gifts":
    case "rsvp":
      return a === undefined ? { kind } : null;
    case "page":
    case "page-photo":
    case "gallery":
      return a && ID.test(a) && b === undefined ? { kind, pageId: a } : null;
    case "items":
      if (!a || !ID.test(a)) return null;
      if (b === undefined) return { kind, pageId: a };
      return ID.test(b) ? { kind, pageId: a, itemId: b } : null;
    default:
      return null;
  }
}

/** Attributes that make an element clickable in the visual editor (hosts only). */
export function editAttrs(enabled: boolean, target: EditTarget, label: string) {
  return enabled ? { "data-edit-target": encodeTarget(target), "data-edit-label": label } : {};
}

export const EDITOR_CHANNEL = "wedding-editor";

/** Preview → editor. */
export type PreviewMessage =
  | { channel: typeof EDITOR_CHANNEL; type: "select"; target: string }
  /** A link inside the preview was clicked: path on the guest site. */
  | { channel: typeof EDITOR_CHANNEL; type: "navigate"; path: string }
  | { channel: typeof EDITOR_CHANNEL; type: "ready" };

/** Editor → preview. */
export type EditorMessage =
  | { channel: typeof EDITOR_CHANNEL; type: "refresh" }
  | { channel: typeof EDITOR_CHANNEL; type: "highlight"; target: string | null };
