"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addPageItemAction,
  deletePageItemAction,
  reorderPageItemAction,
  updatePageItemAction,
} from "@/app/admin/website/actions";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  Field,
  FormMessage,
  Input,
  ReorderButtons,
  SubmitButton,
  Textarea,
  TextBlock,
} from "@/components/ui";

export type PageItemRow = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  position: number;
};

type ItemPageType = "story" | "party" | "faq";

const ITEM_COPY: Record<
  ItemPageType,
  {
    sectionTitle: string;
    sectionDescription: string;
    emptyTitle: string;
    emptyBody: string;
    addHeading: string;
    addButton: string;
    titleLabel: string;
    titlePlaceholder: string;
    subtitleLabel?: string;
    subtitlePlaceholder?: string;
    bodyLabel: string;
    bodyPlaceholder: string;
    deleteConfirm: (title: string) => string;
  }
> = {
  story: {
    sectionTitle: "Story entries",
    sectionDescription: "Shown in order below your intro text.",
    emptyTitle: "No story entries yet",
    emptyBody: "Add your first heading and paragraph below. Nothing shows on your site until you add entries.",
    addHeading: "Add an entry",
    addButton: "Add entry",
    titleLabel: "Heading",
    titlePlaceholder: "e.g. How we met",
    bodyLabel: "Text",
    bodyPlaceholder: "Write the story for this section…",
    deleteConfirm: (t) => `Delete "${t}"?`,
  },
  party: {
    sectionTitle: "Wedding party",
    sectionDescription: "Shown in order as cards on your wedding party page.",
    emptyTitle: "No one added yet",
    emptyBody: "Add the people standing beside you. Nothing shows on your site until you add them.",
    addHeading: "Add a person",
    addButton: "Add person",
    titleLabel: "Name",
    titlePlaceholder: "e.g. Emily Carter",
    subtitleLabel: "Role",
    subtitlePlaceholder: "e.g. Maid of honour, Best man",
    bodyLabel: "About",
    bodyPlaceholder: "A short note about how you know them…",
    deleteConfirm: (t) => `Remove "${t}" from the wedding party?`,
  },
  faq: {
    sectionTitle: "Questions & answers",
    sectionDescription: "Shown in order on your Q&A page.",
    emptyTitle: "No questions yet",
    emptyBody: "Add the questions guests ask most often. Nothing shows on your site until you add them.",
    addHeading: "Add a question",
    addButton: "Add question",
    titleLabel: "Question",
    titlePlaceholder: "e.g. Is there parking at the venue?",
    bodyLabel: "Answer",
    bodyPlaceholder: "Write your answer…",
    deleteConfirm: (t) => `Delete the question "${t}"?`,
  },
};

function ItemRow({
  pageId,
  pageType,
  item,
  isFirst,
  isLast,
}: {
  pageId: string;
  pageType: ItemPageType;
  item: PageItemRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const copy = ITEM_COPY[pageType];
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updatePageItemAction, null);

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close inline editor once save succeeds
      setEditing(false);
    }
  }, [state]);

  const reorderWithPage = async (formData: FormData) => {
    formData.set("pageId", pageId);
    await reorderPageItemAction(formData);
  };

  if (editing) {
    return (
      <li className="px-5 py-4">
        <form action={action} className="max-w-2xl space-y-4">
          <input type="hidden" name="pageId" value={pageId} />
          <input type="hidden" name="itemId" value={item.id} />
          <FormMessage state={state} />
          <Field
            label={copy.titleLabel}
            htmlFor={`edit-title-${item.id}`}
            error={state?.errors?.title}
          >
            <Input
              id={`edit-title-${item.id}`}
              name="title"
              defaultValue={item.title}
              invalid={!!state?.errors?.title}
              required
            />
          </Field>
          {copy.subtitleLabel && (
            <Field label={copy.subtitleLabel} htmlFor={`edit-subtitle-${item.id}`} optional>
              <Input
                id={`edit-subtitle-${item.id}`}
                name="subtitle"
                defaultValue={item.subtitle ?? ""}
                placeholder={copy.subtitlePlaceholder}
              />
            </Field>
          )}
          <Field label={copy.bodyLabel} htmlFor={`edit-body-${item.id}`} optional>
            <Textarea
              id={`edit-body-${item.id}`}
              name="body"
              rows={3}
              defaultValue={item.body ?? ""}
              placeholder={copy.bodyPlaceholder}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton size="sm" pendingLabel="Saving…">
              Save
            </SubmitButton>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-ink">{item.title}</p>
        {item.subtitle && <p className="text-sm text-brand">{item.subtitle}</p>}
        {item.body && <TextBlock text={item.body} className="text-sm text-ink-muted" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ReorderButtons
          id={item.id}
          action={reorderWithPage}
          isFirst={isFirst}
          isLast={isLast}
          label={item.title}
        />
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <form action={deletePageItemAction}>
          <input type="hidden" name="pageId" value={pageId} />
          <input type="hidden" name="itemId" value={item.id} />
          <ConfirmButton confirm={copy.deleteConfirm(item.title)}>Delete</ConfirmButton>
        </form>
      </div>
    </li>
  );
}

export function PageItemsEditor({
  pageId,
  pageType,
  items,
}: {
  pageId: string;
  pageType: ItemPageType;
  items: PageItemRow[];
}) {
  const copy = ITEM_COPY[pageType];
  const [addState, addAction] = useActionState(addPageItemAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState?.ok) {
      formRef.current?.reset();
    }
  }, [addState]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={copy.sectionTitle} description={copy.sectionDescription} />
        {items.length === 0 ? (
          <CardBody>
            <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item, i) => (
              <ItemRow
                key={item.id}
                pageId={pageId}
                pageType={pageType}
                item={item}
                isFirst={i === 0}
                isLast={i === items.length - 1}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={copy.addHeading} />
        <CardBody>
          <form ref={formRef} action={addAction} className="max-w-2xl space-y-4">
            <input type="hidden" name="pageId" value={pageId} />
            <FormMessage state={addState} />
            <Field
              label={copy.titleLabel}
              htmlFor="new-item-title"
              error={addState?.errors?.title}
            >
              <Input
                id="new-item-title"
                name="title"
                placeholder={copy.titlePlaceholder}
                invalid={!!addState?.errors?.title}
                required
              />
            </Field>
            {copy.subtitleLabel && (
              <Field label={copy.subtitleLabel} htmlFor="new-item-subtitle" optional>
                <Input
                  id="new-item-subtitle"
                  name="subtitle"
                  placeholder={copy.subtitlePlaceholder}
                />
              </Field>
            )}
            <Field label={copy.bodyLabel} htmlFor="new-item-body" optional>
              <Textarea
                id="new-item-body"
                name="body"
                rows={3}
                placeholder={copy.bodyPlaceholder}
              />
            </Field>
            <div>
              <SubmitButton pendingLabel="Adding…">{copy.addButton}</SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
