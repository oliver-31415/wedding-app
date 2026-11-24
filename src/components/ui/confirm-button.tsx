"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";

/**
 * Submit button that asks before running a destructive or important action,
 * in a small dialog that can explain the consequences. Put it inside a
 * <form action={...}> with any hidden inputs the action needs; `name`/`value`
 * are submitted like a normal submit button.
 */
export function ConfirmButton({
  children,
  confirm,
  detail,
  confirmLabel,
  variant = "danger",
  size = "sm",
  name,
  value,
  disabled,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  /** The question, e.g. "Delete this event?" */
  confirm: string;
  /** What will happen, e.g. "Its 42 RSVP answers will be deleted too." */
  detail?: ReactNode;
  /** Label of the confirming button; defaults to the trigger's text. */
  confirmLabel?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  name?: string;
  value?: string;
  disabled?: boolean;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const submit = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending || disabled}
        className={className}
        onClick={() => dialog.current?.showModal()}
      >
        {pending && pendingLabel ? pendingLabel : children}
      </Button>
      {/* Hidden real submit button, clicked from the dialog so name/value are sent. */}
      <button ref={submit} type="submit" name={name} value={value} hidden />
      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="space-y-2 px-5 pt-5">
          <p className="text-base font-semibold">{confirm}</p>
          {detail && <div className="text-sm text-ink-muted">{detail}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <Button variant="secondary" size="sm" onClick={() => dialog.current?.close()}>
            Cancel
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={() => {
              dialog.current?.close();
              submit.current?.click();
            }}
          >
            {confirmLabel ?? children}
          </Button>
        </div>
      </dialog>
    </>
  );
}
