"use client";

import Link from "next/link";
import { useState } from "react";
import type { Audience } from "@/db/schema";

/**
 * "Everyone" vs "Only guests with these tags". The one control used for page
 * visibility, event invitations, RSVP questions and message recipients.
 * Submits `${name}Mode` ("all" | "tags") and repeated `${name}Tags` values;
 * parse on the server with `readAudience(formData, name)` from src/lib/forms.ts.
 */
export function AudiencePicker({
  name = "audience",
  tags,
  defaultValue,
  legend,
  everyoneLabel = "Everyone",
  tagsLabel = "Only guests with these tags",
  error,
}: {
  name?: string;
  tags: { id: string; name: string }[];
  defaultValue?: Audience;
  legend?: string;
  everyoneLabel?: string;
  tagsLabel?: string;
  error?: string;
}) {
  const [mode, setMode] = useState<Audience["mode"]>(defaultValue?.mode ?? "all");
  // Kept in state so switching to "Everyone" and back doesn't lose the ticks.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultValue?.mode === "tags" ? defaultValue.tagIds : []),
  );
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Tag ids that no longer exist (tag deleted) — shown so the couple can see why nobody matches.
  const missing = [...selected].filter((id) => !tags.some((t) => t.id === id));

  return (
    <fieldset className="space-y-2" aria-invalid={error ? true : undefined}>
      <legend className={legend ? "mb-2 text-sm font-medium text-ink" : "sr-only"}>{legend ?? "Who"}</legend>
      <label className="flex items-center gap-3 text-sm">
        <input type="radio" name={`${name}Mode`} value="all" checked={mode === "all"} onChange={() => setMode("all")} className="size-4 accent-brand" />
        <span className="font-medium text-ink">{everyoneLabel}</span>
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="radio" name={`${name}Mode`} value="tags" checked={mode === "tags"} onChange={() => setMode("tags")} className="size-4 accent-brand" />
        <span className="font-medium text-ink">{tagsLabel}</span>
      </label>
      {mode === "tags" && (
        <div className="ml-7 space-y-2">
          {tags.length === 0 ? (
            <p className="text-sm text-ink-muted">
              You haven’t made any tags yet. Add tags to guests on the{" "}
              <Link className="text-brand underline" href="/admin/guests">
                guest list
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 rounded-full border border-control px-3 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                >
                  <input
                    type="checkbox"
                    name={`${name}Tags`}
                    value={t.id}
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="size-3.5 accent-brand"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <p className="text-sm text-warn">
              {missing.length === 1 ? "A tag that was chosen here has" : `${missing.length} tags chosen here have`} been deleted.
            </p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
    </fieldset>
  );
}
