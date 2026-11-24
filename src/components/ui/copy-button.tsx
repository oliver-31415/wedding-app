"use client";

import { useState } from "react";
import { Button } from "./button";

function fallbackCopy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

/** Copies `text` to the clipboard and briefly confirms. Use for links, passwords, payment details, lists. */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied ✓",
  size = "sm",
  variant = "secondary",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          fallbackCopy(text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
