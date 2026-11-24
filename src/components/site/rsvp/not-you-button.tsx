"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { forgetHouseholdAction } from "./actions";

export function NotYouButton({
  weddingId,
  slug,
  redirectTo = null,
  label = "Not you?",
  className,
}: {
  weddingId: string;
  slug: string;
  redirectTo?: string | null;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await forgetHouseholdAction({ weddingId, slug, redirectTo });
      if (!redirectTo) {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        "inline-flex min-h-9 items-center text-sm text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink disabled:opacity-50"
      }
    >
      {isPending ? "Switching…" : label}
    </button>
  );
}
