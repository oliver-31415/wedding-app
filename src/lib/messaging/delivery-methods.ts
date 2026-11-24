import type { DeliveryMethod } from "@/db/schema";
import type { Tone } from "@/components/ui";

/** How a message reached someone: the app emailed it, or the couple recorded another way. */
export const DELIVERY_METHOD_META: Record<DeliveryMethod, { label: string; tone: Tone }> = {
  email: { label: "Emailed", tone: "good" },
  post: { label: "Posted", tone: "good" },
  text: { label: "Texted", tone: "good" },
  in_person: { label: "In person", tone: "good" },
  other: { label: "Sent another way", tone: "good" },
};

/** Ways the couple can record (everything but email). */
export const MANUAL_METHODS = ["post", "text", "in_person", "other"] as const satisfies readonly DeliveryMethod[];
export type ManualMethod = (typeof MANUAL_METHODS)[number];
export const isManualMethod = (v: string | null | undefined): v is ManualMethod =>
  (MANUAL_METHODS as readonly string[]).includes(v ?? "");
