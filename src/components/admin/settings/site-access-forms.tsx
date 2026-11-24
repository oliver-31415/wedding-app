"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmButton,
  Field,
  FormMessage,
  Input,
  Notice,
  SubmitButton,
} from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { CopyButton } from "@/components/ui";
import type { PublishWarning } from "./helpers";

export function PublishCard({
  published,
  siteUrl,
  warnings,
  action,
}: {
  published: boolean;
  siteUrl: string;
  warnings: PublishWarning[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <Card>
      <CardHeader
        title="Website status"
        description="Control whether guests can view your wedding website."
        actions={published ? <Badge tone="good">Published</Badge> : <Badge tone="warn">Draft</Badge>}
      />
      <CardBody className="max-w-2xl space-y-4">
        <FormMessage state={state} />
        <p className="text-sm leading-relaxed text-ink-muted">
          {published ? (
            <>
              Your wedding site is live at{" "}
              <a href={siteUrl} target="_blank" rel="noreferrer" className="break-all font-medium text-brand hover:underline">
                {siteUrl}
              </a>
              . Guests can see pages based on each page&apos;s visibility setting.
            </>
          ) : (
            "Guests see nothing until your site is published. You and your co-hosts can always preview your site while it's a draft."
          )}
        </p>

        {!published && warnings.length > 0 && (
          <div className="space-y-3">
            {warnings.map((w) => (
              <Notice key={w.id} tone="warn" title={w.title}>
                <p>{w.body}</p>
                <Link href={w.href} className="mt-1.5 inline-block font-medium underline underline-offset-2">
                  {w.actionLabel} →
                </Link>
              </Notice>
            ))}
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="published" value={published ? "false" : "true"} />
          <SubmitButton
            variant={published ? "secondary" : "primary"}
            pendingLabel={published ? "Unpublishing…" : "Publishing…"}
          >
            {published ? "Unpublish site" : "Publish site"}
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}

export function SitePasswordCard({
  sitePassword,
  saveAction,
  removeAction,
}: {
  sitePassword: string | null;
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const [state, formAction] = useActionState(saveAction, null);

  return (
    <Card>
      <CardHeader
        title="Site password"
        description="Shared password for pages set to Password visibility."
      />
      <CardBody className="max-w-2xl space-y-5">
        <p className="text-sm leading-relaxed text-ink-muted">
          Pages set to <span className="font-medium text-ink">Password</span> ask visitors for this password before
          showing their content. Guests who arrive via their personal invitation link or look up their invitation
          don&apos;t need to enter it.
        </p>

        {sitePassword ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Current password</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-sunken px-4 py-3">
              <code className="break-all font-mono text-sm font-medium text-ink">{sitePassword}</code>
              <CopyButton text={sitePassword} label="Copy password" />
            </div>
          </div>
        ) : (
          <Notice tone="info">No site password is set yet.</Notice>
        )}

        <form action={formAction} className="space-y-4" noValidate>
          <FormMessage state={state} />
          <Field
            label={sitePassword ? "Change site password" : "Set a site password"}
            htmlFor="sitePassword"
            hint={
              sitePassword
                ? "Changing the password signs out visitors who unlocked your site with the old one."
                : "Choose something easy for guests to type, such as your venue or town."
            }
            error={state?.errors?.sitePassword}
          >
            <Input
              id="sitePassword"
              name="sitePassword"
              type="text"
              placeholder="e.g. bowral"
              invalid={!!state?.errors?.sitePassword}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Saving…">
              {sitePassword ? "Change password" : "Set password"}
            </SubmitButton>
          </div>
        </form>

        {sitePassword && (
          <div className="border-t border-line pt-4">
            <form action={removeAction}>
              <ConfirmButton
                confirm="Remove the site password? Guests won't be able to unlock Password pages with a password until you set a new one."
                size="sm"
              >
                Remove password
              </ConfirmButton>
            </form>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function SearchVisibilityCard({
  searchVisible,
  action,
}: {
  searchVisible: boolean;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [checked, setChecked] = useState(searchVisible);

  return (
    <Card>
      <CardHeader
        title="Search engines"
        description="Choose whether search engines can index your wedding website."
      />
      <CardBody className="max-w-2xl">
        <form action={formAction} className="space-y-4">
          <FormMessage state={state} />
          <Checkbox
            name="searchVisible"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            label="Let search engines show your site"
            hint="Off by default. When turned off, search engines like Google are told not to index your wedding site."
          />
          <div>
            <SubmitButton pendingLabel="Saving…">Save preference</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
