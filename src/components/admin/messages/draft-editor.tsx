"use client";

import Link from "next/link";
import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import {
  deleteDraft,
  saveDraft,
  sendMessage,
  sendTestMessage,
} from "@/app/admin/messages/[id]/actions";
import {
  AudiencePicker,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  Field,
  FormMessage,
  Input,
  Notice,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import type { Audience, MessageKind, MessageRecipients } from "@/db/schema";
import { describePlan, firstOfPlan, type SendPlan } from "@/lib/email-quota";
import { selectRecipients } from "@/lib/messaging/recipients";
import { renderMessage, type RenderWedding } from "@/lib/messaging/render";
import {
  DEFAULT_BUTTON_LABELS,
  type ButtonTarget,
} from "@/lib/messaging/templates";
import { guestName } from "@/lib/rsvp/model";
import type { WeddingSnapshot } from "@/lib/stats";
import {
  BUTTON_TARGET_OPTIONS,
  isButtonTarget,
  isRsvpStatus,
  RSVP_STATUS_OPTIONS,
} from "./format";

export type EditableMessage = {
  id: string;
  kind: MessageKind;
  subject: string;
  body: string;
  buttonTarget: ButtonTarget | null;
  buttonLabel: string | null;
  recipients: MessageRecipients;
};

/** When a bulk send's emails would go under the email limits (src/lib/email-quota.ts). */
export type EmailPlanInfo = { plan: SendPlan; now: number; timeZone: string; daily: number; monthly: number };

const DEFAULT_LABEL_SET = new Set(Object.values(DEFAULT_BUTTON_LABELS));

export function DraftEditor({
  message,
  wedding,
  snapshot,
  tags,
  hostEmail,
  hostName,
  baseUrl,
  emailConfigured,
  isDev,
  emailPlan,
}: {
  message: EditableMessage;
  wedding: RenderWedding;
  snapshot: WeddingSnapshot;
  tags: { id: string; name: string }[];
  hostEmail: string;
  hostName: string;
  baseUrl: string;
  emailConfigured: boolean;
  isDev: boolean;
  emailPlan: EmailPlanInfo;
}) {
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [buttonTarget, setButtonTarget] = useState<"" | ButtonTarget>(
    message.buttonTarget ?? "",
  );
  const [buttonLabel, setButtonLabel] = useState(message.buttonLabel ?? "");
  const [audience, setAudience] = useState<Audience>(message.recipients.audience);
  const [rsvpStatus, setRsvpStatus] = useState<MessageRecipients["rsvpStatus"]>(
    message.recipients.rsvpStatus,
  );
  const [lastAction, setLastAction] = useState<"save" | "test" | "send" | null>(null);

  const [saveState, saveAction] = useActionState(saveDraft, null);
  const [testState, testAction] = useActionState(sendTestMessage, null);
  const [sendState, sendAction] = useActionState(sendMessage, null);

  const activeState =
    lastAction === "test"
      ? testState
      : lastAction === "send"
        ? sendState
        : saveState;

  const audienceWrapRef = useRef<HTMLDivElement>(null);

  const syncAudience = useCallback(() => {
    requestAnimationFrame(() => {
      const el = audienceWrapRef.current;
      if (!el) return;
      const modeInput = el.querySelector<HTMLInputElement>(
        'input[name="audienceMode"]:checked',
      );
      const mode = modeInput?.value === "tags" ? "tags" : "all";
      if (mode === "all") {
        setAudience({ mode: "all" });
      } else {
        const tagIds = Array.from(
          el.querySelectorAll<HTMLInputElement>('input[name="audienceTags"]:checked'),
        ).map((input) => input.value);
        setAudience({ mode: "tags", tagIds });
      }
    });
  }, []);

  const guestById = useMemo(
    () => new Map(snapshot.guests.map((g) => [g.id, g])),
    [snapshot.guests],
  );

  const recipientPreview = useMemo(
    () => selectRecipients(snapshot, { audience, rsvpStatus }),
    [snapshot, audience, rsvpStatus],
  );

  const firstRecipient = recipientPreview.recipients[0];
  const sampleFirstName =
    firstRecipient?.firstName ?? (hostName.trim().split(/\s+/)[0] || "Friend");
  // Each guest's real personal link is filled in on the server when sending;
  // secret links never reach the browser, so the preview uses a stand-in.
  const sampleInviteToken = "your-personal-link";

  const renderedPreview = useMemo(
    () =>
      renderMessage({
        wedding,
        message: {
          subject,
          body,
          buttonTarget: buttonTarget || null,
          buttonLabel: buttonLabel || null,
        },
        recipient: { firstName: sampleFirstName },
        inviteToken: sampleInviteToken,
        baseUrl,
      }),
    [wedding, subject, body, buttonTarget, buttonLabel, sampleFirstName, sampleInviteToken, baseUrl],
  );

  const recipientCount = recipientPreview.recipients.length;
  const householdCount = recipientPreview.households;
  const plan = firstOfPlan(emailPlan.plan, recipientCount);
  const planWords = describePlan(plan, emailPlan.now, emailPlan.timeZone);

  const handleButtonTargetChange = (next: string) => {
    const nextTarget: "" | ButtonTarget = isButtonTarget(next) ? next : "";
    setButtonTarget(nextTarget);
    if (!nextTarget) {
      setButtonLabel("");
    } else if (!buttonLabel.trim() || DEFAULT_LABEL_SET.has(buttonLabel.trim())) {
      setButtonLabel(DEFAULT_BUTTON_LABELS[nextTarget]);
    }
  };

  return (
    <div className="space-y-6">
      {!emailConfigured && (
        <Notice tone="warn">
          Email isn&apos;t set up yet, so messages are saved to the outbox instead of
          being sent.
          {isDev && (
            <>
              {" "}
              <Link href="/admin/dev/outbox" className="font-medium underline">
                Open dev outbox
              </Link>
            </>
          )}
        </Notice>
      )}

      <FormMessage state={activeState} />

      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-6 lg:space-y-0">
        {/* Left column: composer & recipients */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Message" />
            <CardBody>
              <form
                action={saveAction}
                onSubmit={() => setLastAction("save")}
                className="space-y-5"
              >
                <input type="hidden" name="messageId" value={message.id} />

                <Field
                  label="Subject"
                  htmlFor="subject"
                  error={activeState?.errors?.subject}
                >
                  <Input
                    id="subject"
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Save the date — Alex & Sam"
                    invalid={!!activeState?.errors?.subject}
                    required
                  />
                </Field>

                <Field
                  label="Message"
                  htmlFor="body"
                  hint="Use {first_name} to insert each guest's first name."
                  error={activeState?.errors?.body}
                >
                  <Textarea
                    id="body"
                    name="body"
                    rows={10}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hi {first_name},&#10;&#10;Write your message here…"
                    invalid={!!activeState?.errors?.body}
                    required
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Button" htmlFor="buttonTarget" optional>
                    <Select
                      id="buttonTarget"
                      name="buttonTarget"
                      value={buttonTarget}
                      onChange={(e) => handleButtonTargetChange(e.target.value)}
                    >
                      {BUTTON_TARGET_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {buttonTarget && (
                    <Field label="Button label" htmlFor="buttonLabel">
                      <Input
                        id="buttonLabel"
                        name="buttonLabel"
                        value={buttonLabel}
                        onChange={(e) => setButtonLabel(e.target.value)}
                        placeholder={DEFAULT_BUTTON_LABELS[buttonTarget]}
                      />
                    </Field>
                  )}
                </div>

                <div className="space-y-4 border-t border-line pt-5">
                  <h3 className="text-sm font-semibold text-ink">Recipients</h3>

                  <div ref={audienceWrapRef} onChange={syncAudience}>
                    <AudiencePicker
                      name="audience"
                      tags={tags}
                      defaultValue={message.recipients.audience}
                      error={activeState?.errors?.audience}
                    />
                  </div>

                  <Field label="RSVP status" htmlFor="rsvpStatus">
                    <Select
                      id="rsvpStatus"
                      name="rsvpStatus"
                      value={rsvpStatus}
                      onChange={(e) => {
                        if (isRsvpStatus(e.target.value)) {
                          setRsvpStatus(e.target.value);
                        }
                      }}
                    >
                      {RSVP_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                  <SubmitButton variant="secondary" pendingLabel="Saving…">
                    Save draft
                  </SubmitButton>
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Send & Delete actions */}
          <Card>
            <CardHeader
              title="Send"
              description="Send yourself a test first, or send this email to all matching guests."
            />
            <CardBody className="space-y-4">
              {planWords && (
                <Notice tone="info" title="Your emails will go out in batches">
                  Your email account sends up to {emailPlan.daily} emails a day and {emailPlan.monthly} a
                  month, with a few kept free for RSVP confirmations. {planWords} You don&apos;t need to do
                  anything: they send by themselves.
                </Notice>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <form
                  action={sendAction}
                  onSubmit={() => setLastAction("send")}
                >
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="subject" value={subject} />
                  <input type="hidden" name="body" value={body} />
                  <input type="hidden" name="buttonTarget" value={buttonTarget} />
                  <input type="hidden" name="buttonLabel" value={buttonLabel} />
                  <input type="hidden" name="audienceMode" value={audience.mode} />
                  {audience.mode === "tags" &&
                    audience.tagIds.map((tagId) => (
                      <input
                        key={tagId}
                        type="hidden"
                        name="audienceTags"
                        value={tagId}
                      />
                    ))}
                  <input type="hidden" name="rsvpStatus" value={rsvpStatus} />

                  {recipientCount > 0 ? (
                    <ConfirmButton
                      variant="primary"
                      size="md"
                      confirm={`Send this email to ${recipientCount} ${
                        recipientCount === 1 ? "guest" : "guests"
                      }? Once sent, it can't be unsent.`}
                      detail={planWords || undefined}
                    >
                      Send to {recipientCount}{" "}
                      {recipientCount === 1 ? "guest" : "guests"}
                    </ConfirmButton>
                  ) : (
                    <Button type="button" variant="primary" size="md" disabled>
                      Send to 0 guests
                    </Button>
                  )}
                </form>

                <form
                  action={testAction}
                  onSubmit={() => setLastAction("test")}
                >
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="subject" value={subject} />
                  <input type="hidden" name="body" value={body} />
                  <input type="hidden" name="buttonTarget" value={buttonTarget} />
                  <input type="hidden" name="buttonLabel" value={buttonLabel} />
                  <input type="hidden" name="audienceMode" value={audience.mode} />
                  {audience.mode === "tags" &&
                    audience.tagIds.map((tagId) => (
                      <input
                        key={tagId}
                        type="hidden"
                        name="audienceTags"
                        value={tagId}
                      />
                    ))}
                  <input type="hidden" name="rsvpStatus" value={rsvpStatus} />
                  <SubmitButton variant="secondary" pendingLabel="Sending test…">
                    Send test to me
                  </SubmitButton>
                </form>
              </div>

              <p className="text-xs text-ink-muted">
                Test emails go to {hostEmail} with &ldquo;[Test]&rdquo; added to the
                subject and don&apos;t change this draft.
              </p>

              <div className="border-t border-line pt-4">
                <form action={deleteDraft}>
                  <input type="hidden" name="messageId" value={message.id} />
                  <ConfirmButton
                    variant="danger"
                    size="sm"
                    confirm="Delete this draft? This can't be undone."
                  >
                    Delete draft
                  </ConfirmButton>
                </form>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right column: live recipient summary & email preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Recipient summary"
              description={`Will send to ${recipientCount} ${
                recipientCount === 1 ? "guest" : "guests"
              } in ${householdCount} ${
                householdCount === 1 ? "household" : "households"
              }`}
            />
            <CardBody className="space-y-4">
              {recipientCount > 0 ? (
                <details className="rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-sm">
                  <summary className="cursor-pointer font-medium text-ink select-none">
                    View recipients ({recipientCount})
                  </summary>
                  <ul className="mt-3 max-h-60 divide-y divide-line overflow-y-auto">
                    {recipientPreview.recipients.map((r) => {
                      const guest = guestById.get(r.guestId);
                      const fullName = guest ? guestName(guest) : r.firstName;
                      return (
                        <li
                          key={`${r.guestId}-${r.email}`}
                          className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-xs"
                        >
                          <Link
                            href={`/admin/guests/${r.householdId}`}
                            className="font-medium text-ink hover:text-brand hover:underline"
                          >
                            {fullName}
                          </Link>
                          <span className="truncate text-ink-muted">{r.email}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : (
                <p className="text-sm text-ink-muted">
                  No guests with an email address match the current filters.
                </p>
              )}

              {recipientPreview.missingEmail.length > 0 && (
                <Notice
                  tone="warn"
                  title={`${recipientPreview.missingEmail.length} ${
                    recipientPreview.missingEmail.length === 1
                      ? "guest has"
                      : "guests have"
                  } no email address and will be skipped`}
                >
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {recipientPreview.missingEmail.map((g) => {
                      const guest = guestById.get(g.guestId);
                      return (
                        <li key={g.guestId}>
                          {guest ? (
                            <Link
                              href={`/admin/guests/${guest.householdId}`}
                              className="underline underline-offset-2"
                            >
                              {g.name}
                            </Link>
                          ) : (
                            <span>{g.name}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Notice>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Email preview"
              description={
                firstRecipient
                  ? `Previewing for ${firstRecipient.firstName} (${firstRecipient.email})`
                  : `Sample preview for ${sampleFirstName}`
              }
            />
            <CardBody className="space-y-3">
              <div className="rounded-lg border border-line bg-sunken px-3 py-2 text-xs">
                <span className="text-ink-muted">Subject: </span>
                <span className="font-medium text-ink">
                  {renderedPreview.subject || "(No subject)"}
                </span>
              </div>
              <iframe
                title="Rendered email preview"
                srcDoc={renderedPreview.html}
                sandbox=""
                className="h-[460px] w-full rounded-lg border border-line bg-canvas"
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
