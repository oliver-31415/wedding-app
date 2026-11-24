"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { savePageAction } from "@/app/admin/website/actions";
import {
  AudiencePicker,
  Field,
  FormMessage,
  Input,
  RadioGroup,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import type { Audience, PageType, PageVisibility } from "@/db/schema";
import { PAGE_VISIBILITY } from "@/db/schema";
import { pageUrl, VISIBILITY_META } from "@/lib/pages";

type PageData = {
  id: string;
  type: PageType;
  title: string;
  slug: string;
  body: string | null;
  visibility: PageVisibility;
  audience: Audience;
};

export function PageSettingsForm({
  page,
  weddingSlug,
  tags,
}: {
  page: PageData;
  weddingSlug: string;
  tags: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(savePageAction, null);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [body, setBody] = useState(page.body ?? "");
  const [visibility, setVisibility] = useState<PageVisibility>(page.visibility);

  const bodyLabel =
    page.type === "home" ? "Welcome message" : page.type === "custom" ? "Page text" : "Intro text";
  const bodyHint =
    page.type === "home" ? (
      <>
        Shown on your front page. Your names, date and location come from{" "}
        <Link href="/admin/settings" className="text-brand underline">
          Settings
        </Link>{" "}
        and only appear if you&rsquo;ve set them.
      </>
    ) : page.type === "custom" ? (
      "Blank lines make paragraphs. Web addresses become clickable links."
    ) : (
      "Shown above this page’s content. Leave blank to skip."
    );

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <input type="hidden" name="pageId" value={page.id} />
      <FormMessage state={state} />

      <Field label="Title" htmlFor="page-title" error={state?.errors?.title}>
        <Input
          id="page-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          invalid={!!state?.errors?.title}
          required
        />
      </Field>

      {page.type === "custom" ? (
        <Field
          label="URL slug"
          htmlFor="page-slug"
          hint={`Your page address will be /w/${weddingSlug}/${slug || page.slug}`}
          error={state?.errors?.slug}
        >
          <div className="flex items-center rounded-lg border border-line-strong bg-surface focus-within:border-brand">
            <span className="pl-3 text-sm text-ink-muted select-none">/w/{weddingSlug}/</span>
            <input
              id="page-slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-invalid={!!state?.errors?.slug || undefined}
              className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink focus:outline-none"
            />
          </div>
        </Field>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Page address</p>
          <p className="text-sm text-ink-muted">
            <code className="rounded bg-sunken px-1.5 py-0.5 text-xs text-ink">
              {pageUrl(weddingSlug, page.slug)}
            </code>{" "}
            (fixed for this page type)
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Who can see this page</p>
        <RadioGroup
          name="visibility"
          defaultValue={page.visibility}
          onChange={(v) => setVisibility(v as PageVisibility)}
          options={PAGE_VISIBILITY.map((v) => ({
            value: v,
            label: VISIBILITY_META[v].label,
            hint: VISIBILITY_META[v].hint,
          }))}
        />
      </div>

      {visibility === "guests" && (
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="mb-2 text-sm font-medium text-ink">Which invited guests</p>
          <AudiencePicker
            name="audience"
            tags={tags}
            defaultValue={page.audience}
            everyoneLabel="Everyone invited"
            tagsLabel="Only guests with these tags"
            error={state?.errors?.audience}
          />
        </div>
      )}

      <Field
        label={bodyLabel}
        htmlFor="page-body"
        optional
        hint={bodyHint}
        error={state?.errors?.body}
      >
        <Textarea
          id="page-body"
          name="body"
          rows={page.type === "custom" ? 8 : 4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            page.type === "home"
              ? "Write a short welcome for your guests…"
              : page.type === "custom"
                ? "Write your page content here…"
                : "Optional intro note…"
          }
          invalid={!!state?.errors?.body}
        />
      </Field>

      <div>
        <SubmitButton pendingLabel="Saving…">Save page</SubmitButton>
      </div>
    </form>
  );
}
