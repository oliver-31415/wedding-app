"use client";

import { Button, CopyButton } from "@/components/ui";

/** Copies the plain-text thank-you list; disabled when there's nothing to copy. */
export function CopyListButton({ text, label = "Copy list", size = "md" }: { text: string; label?: string; size?: "sm" | "md" }) {
  if (!text) {
    return (
      <Button size={size} variant="secondary" disabled>
        {label}
      </Button>
    );
  }
  return <CopyButton text={text} label={label} size={size} />;
}
