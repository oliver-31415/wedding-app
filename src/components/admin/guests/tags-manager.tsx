"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from "@/components/ui";
import { createTagAction, deleteTagAction, renameTagAction } from "@/app/admin/guests/tags/actions";
import type { ActionState } from "@/lib/forms";

export type TagWithCount = {
  id: string;
  name: string;
  guestCount: number;
  /** Events, pages, questions and drafts limited to this tag — it can't be deleted while any exist. */
  usedBy: string[];
};

function TagRow({ tag }: { tag: TagWithCount }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const res = await renameTagAction(prev, formData);
    if (res?.ok) setEditing(false);
    return res;
  }, null);

  return (
    <li className="px-5 py-4">
      {editing ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="tagId" value={tag.id} />
          <FormMessage state={state} />
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Tag name" htmlFor={`rename-${tag.id}`} error={state?.errors?.name} className="min-w-[12rem] flex-1">
              <Input
                id={`rename-${tag.id}`}
                name="name"
                defaultValue={tag.name}
                invalid={!!state?.errors?.name}
                autoFocus
              />
            </Field>
            <div className="flex items-center gap-2 pb-0.5">
              <SubmitButton size="sm" pendingLabel="Saving…">
                Save
              </SubmitButton>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-medium text-ink">{tag.name}</span>
            <Badge tone="neutral">
              {tag.guestCount} {tag.guestCount === 1 ? "guest" : "guests"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <form action={deleteTagAction}>
              <input type="hidden" name="tagId" value={tag.id} />
              <ConfirmButton
                variant="danger"
                size="sm"
                disabled={tag.usedBy.length > 0}
                confirm={`Delete the “${tag.name}” tag?`}
                detail={`It will be removed from ${tag.guestCount} ${tag.guestCount === 1 ? "guest" : "guests"}. Nothing else uses it.`}
              >
                Delete
              </ConfirmButton>
            </form>
          </div>
        </div>
      )}
      {!editing && tag.usedBy.length > 0 && (
        <p className="mt-2 text-sm text-ink-muted">
          Used by {tag.usedBy.join(", ")}. Change {tag.usedBy.length === 1 ? "it" : "those"} to stop using this tag before
          deleting it — otherwise those guests would quietly lose access.
        </p>
      )}
    </li>
  );
}

export function TagsManager({ tags }: { tags: TagWithCount[] }) {
  const [createState, createAction] = useActionState(createTagAction, null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (createState?.ok && createInputRef.current) {
      createInputRef.current.value = "";
    }
  }, [createState]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Add a tag"
          description="Use tags to organise guests, invite groups to specific events, or limit pages and RSVP questions."
        />
        <CardBody>
          <form action={createAction} className="max-w-2xl space-y-4">
            <FormMessage state={createState} />
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Tag name" htmlFor="new-tag-name" error={createState?.errors?.name} className="min-w-[14rem] flex-1">
                <Input
                  ref={createInputRef}
                  id="new-tag-name"
                  name="name"
                  placeholder="e.g. Family, Wedding party, Out of town"
                  invalid={!!createState?.errors?.name}
                />
              </Field>
              <SubmitButton pendingLabel="Creating…">Create tag</SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>

      {tags.length === 0 ? (
        <EmptyState
          title="No tags yet"
          body="Create tags above to group guests for events, website pages, RSVP questions and messages."
        />
      ) : (
        <Card>
          <CardHeader
            title={`Your tags (${tags.length})`}
            description="Renaming a tag updates it everywhere automatically."
          />
          <ul className="divide-y divide-line">
            {tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
