import { markReachedAction, unmarkReachedAction } from "@/app/admin/messages/reach-actions";
import { SubmitButton } from "@/components/ui";
import { DELIVERY_METHOD_META, MANUAL_METHODS } from "@/lib/messaging/delivery-methods";

/** "Mark as sent: [Posted ▾] [Mark]" for one or more guests the message hasn't reached. */
export function MarkReachedForm({
  messageId,
  guestIds,
  label = "Mark as sent",
  idSuffix,
}: {
  messageId: string;
  guestIds: string[];
  label?: string;
  /** Keeps the select's id unique when several forms share a page. */
  idSuffix: string;
}) {
  const selectId = `method-${idSuffix}`;
  return (
    <form action={markReachedAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="messageId" value={messageId} />
      {guestIds.map((id) => (
        <input key={id} type="hidden" name="guestId" value={id} />
      ))}
      <label htmlFor={selectId} className="sr-only">
        How was it sent?
      </label>
      <select
        id={selectId}
        name="method"
        defaultValue="post"
        className="h-8 rounded-[var(--radius-control)] border border-control bg-surface px-2 text-sm text-ink"
      >
        {MANUAL_METHODS.map((m) => (
          <option key={m} value={m}>
            {DELIVERY_METHOD_META[m].label}
          </option>
        ))}
      </select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function UnmarkReachedButton({ deliveryId }: { deliveryId: string }) {
  return (
    <form action={unmarkReachedAction}>
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <SubmitButton size="sm" variant="ghost" pendingLabel="Undoing…">
        Undo
      </SubmitButton>
    </form>
  );
}
