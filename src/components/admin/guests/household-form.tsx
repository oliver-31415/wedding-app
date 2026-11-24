"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmButton,
  Field,
  FormMessage,
  Input,
  SubmitButton,
  Textarea,
  cn,
} from "@/components/ui";
import {
  createHouseholdAction,
  createTagInlineAction,
  deleteHouseholdAction,
  removePlusOneAction,
  updateHouseholdAction,
} from "@/app/admin/guests/actions";

export type HouseholdMemberDraft = {
  key: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isChild: boolean;
  tagIds: string[];
};

export type InitialHouseholdData = {
  envelopeName: string | null;
  plusOnesAllowed: number;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  notes: string | null;
};

type TagOption = { id: string; name: string };
type PlusOneSummary = { id: string; firstName: string; lastName: string };

function makeBlankMember(key: string): HouseholdMemberDraft {
  return {
    key,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    isChild: false,
    tagIds: [],
  };
}

export function HouseholdForm({
  mode,
  householdId,
  initialHousehold,
  initialMembers,
  plusOnes = [],
  tags,
}: {
  mode: "create" | "edit";
  householdId?: string;
  initialHousehold?: InitialHouseholdData;
  initialMembers?: Omit<HouseholdMemberDraft, "key">[];
  plusOnes?: PlusOneSummary[];
  tags: TagOption[];
}) {
  const nextKeyRef = useRef(1);
  const newKey = () => `m-${nextKeyRef.current++}`;

  const [members, setMembers] = useState<HouseholdMemberDraft[]>(() => {
    if (initialMembers && initialMembers.length > 0) {
      return initialMembers.map((m, idx) => ({ ...m, key: m.id ?? `init-${idx}` }));
    }
    return [makeBlankMember("init-0")];
  });

  // Sync members with fresh server data after a successful save so newly created
  // guests receive their database IDs without losing validation error state.
  const initialMembersSig = JSON.stringify(initialMembers ?? []);
  const [prevMembersSig, setPrevMembersSig] = useState(initialMembersSig);
  if (prevMembersSig !== initialMembersSig) {
    setPrevMembersSig(initialMembersSig);
    if (initialMembers && initialMembers.length > 0) {
      setMembers(initialMembers.map((m, idx) => ({ ...m, key: m.id ?? `sync-${idx}` })));
    }
  }

  const [inlineTags, setInlineTags] = useState<TagOption[]>([]);
  const availableTags = useMemo(() => {
    const byId = new Map<string, TagOption>();
    for (const t of tags) byId.set(t.id, t);
    for (const t of inlineTags) byId.set(t.id, t);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "en-AU"));
  }, [tags, inlineTags]);

  const [newTagInput, setNewTagInput] = useState<Record<string, string>>({});
  const [newTagError, setNewTagError] = useState<Record<string, string>>({});
  const [creatingTagFor, setCreatingTagFor] = useState<string | null>(null);

  const actionFn =
    mode === "edit" && householdId ? updateHouseholdAction.bind(null, householdId) : createHouseholdAction;
  const [state, formAction] = useActionState(actionFn, null);

  function updateMember(index: number, patch: Partial<HouseholdMemberDraft>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function toggleTag(index: number, tagId: string) {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        const has = m.tagIds.includes(tagId);
        return { ...m, tagIds: has ? m.tagIds.filter((id) => id !== tagId) : [...m.tagIds, tagId] };
      }),
    );
  }

  function addMember() {
    setMembers((prev) => [...prev, makeBlankMember(newKey())]);
  }

  function removeMember(index: number) {
    setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleCreateTagInline(memberIndex: number, memberKey: string) {
    const raw = (newTagInput[memberKey] ?? "").trim();
    if (!raw) {
      setNewTagError((prev) => ({ ...prev, [memberKey]: "Enter a tag name." }));
      return;
    }
    setCreatingTagFor(memberKey);
    setNewTagError((prev) => ({ ...prev, [memberKey]: "" }));
    try {
      const res = await createTagInlineAction(raw);
      if (!res.ok) {
        setNewTagError((prev) => ({ ...prev, [memberKey]: res.error }));
        return;
      }
      setInlineTags((prev) => {
        if (prev.some((t) => t.id === res.tag.id)) return prev;
        return [...prev, res.tag];
      });
      setMembers((prev) =>
        prev.map((m, i) =>
          i === memberIndex && !m.tagIds.includes(res.tag.id) ? { ...m, tagIds: [...m.tagIds, res.tag.id] } : m,
        ),
      );
      setNewTagInput((prev) => ({ ...prev, [memberKey]: "" }));
    } finally {
      setCreatingTagFor(null);
    }
  }

  const serializedMembers = JSON.stringify(
    members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      phone: m.phone,
      isChild: m.isChild,
      tagIds: m.tagIds,
    })),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={mode === "create" ? "Household & guests" : "Household details"}
          description="People in the same household RSVP together."
        />
        <CardBody>
          <form action={formAction} noValidate className="max-w-2xl space-y-6">
            <FormMessage state={state} />
            <input type="hidden" name="membersJson" value={serializedMembers} />

            {/* Members */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Guests in this household</h3>
                  <p className="text-xs text-ink-muted">Add everyone invited under this invitation.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={addMember}>
                  Add member
                </Button>
              </div>

              {state?.errors?.members && <p className="text-sm text-bad">{state.errors.members}</p>}

              <div className="space-y-4">
                {members.map((member, index) => {
                  const firstErr = state?.errors?.[`member.${index}.firstName`];
                  const lastErr = state?.errors?.[`member.${index}.lastName`];
                  const emailErr = state?.errors?.[`member.${index}.email`];
                  const tagDraft = newTagInput[member.key] ?? "";
                  const tagErr = newTagError[member.key] ?? "";

                  return (
                    <div
                      key={member.key}
                      className="space-y-4 rounded-xl border border-line bg-canvas/50 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                          Guest {index + 1}
                        </span>
                        {members.length > 1 ? (
                          <Button variant="ghost" size="sm" onClick={() => removeMember(index)}>
                            Remove
                          </Button>
                        ) : (
                          <span className="text-xs text-ink-faint">
                            {mode === "edit" ? "Delete household to remove last guest" : "At least one guest required"}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="First name" htmlFor={`m-${index}-first`} error={firstErr}>
                          <Input
                            id={`m-${index}-first`}
                            value={member.firstName}
                            onChange={(e) => updateMember(index, { firstName: e.target.value })}
                            placeholder="e.g. Alex"
                            required
                            invalid={!!firstErr}
                          />
                        </Field>
                        <Field label="Last name" htmlFor={`m-${index}-last`} error={lastErr}>
                          <Input
                            id={`m-${index}-last`}
                            value={member.lastName}
                            onChange={(e) => updateMember(index, { lastName: e.target.value })}
                            placeholder="e.g. Jones"
                            required
                            invalid={!!lastErr}
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Email" htmlFor={`m-${index}-email`} optional error={emailErr}>
                          <Input
                            id={`m-${index}-email`}
                            type="email"
                            value={member.email}
                            onChange={(e) => updateMember(index, { email: e.target.value })}
                            placeholder="name@example.com"
                            invalid={!!emailErr}
                          />
                        </Field>
                        <Field label="Phone" htmlFor={`m-${index}-phone`} optional>
                          <Input
                            id={`m-${index}-phone`}
                            type="tel"
                            value={member.phone}
                            onChange={(e) => updateMember(index, { phone: e.target.value })}
                            placeholder="0412 345 678"
                          />
                        </Field>
                      </div>

                      <Checkbox
                        label="Child"
                        checked={member.isChild}
                        onChange={(e) => updateMember(index, { isChild: e.target.checked })}
                      />

                      {/* Tags per member + inline creation */}
                      <div className="space-y-2 border-t border-line pt-3">
                        <p className="text-sm font-medium text-ink">
                          Tags <span className="ml-1 font-normal text-ink-faint">Optional</span>
                        </p>
                        {availableTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {availableTags.map((t) => {
                              const checked = member.tagIds.includes(t.id);
                              return (
                                <label
                                  key={t.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                                    checked
                                      ? "border-brand bg-brand-soft text-brand-strong"
                                      : "border-line-strong bg-surface text-ink hover:bg-sunken",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleTag(index, t.id)}
                                    className="size-3.5 accent-brand"
                                  />
                                  <span>{t.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Input
                            value={tagDraft}
                            onChange={(e) => {
                              setNewTagInput((prev) => ({ ...prev, [member.key]: e.target.value }));
                              if (tagErr) setNewTagError((prev) => ({ ...prev, [member.key]: "" }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleCreateTagInline(index, member.key);
                              }
                            }}
                            placeholder="New tag name"
                            aria-label={`Create a new tag for guest ${index + 1}`}
                            className="h-8 w-44 text-xs"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={creatingTagFor === member.key}
                            onClick={() => void handleCreateTagInline(index, member.key)}
                          >
                            {creatingTagFor === member.key ? "Adding…" : "Add tag"}
                          </Button>
                        </div>
                        {tagErr && <p className="text-xs text-bad">{tagErr}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Envelope & Plus-ones */}
            <div className="space-y-4 border-t border-line pt-5">
              <Field
                label="Envelope name"
                htmlFor="envelopeName"
                optional
                hint="Leave blank to use members’ names."
                error={state?.errors?.envelopeName}
              >
                <Input
                  id="envelopeName"
                  name="envelopeName"
                  defaultValue={initialHousehold?.envelopeName ?? ""}
                  placeholder="e.g. The Jones Family"
                />
              </Field>

              <Field
                label="Plus-ones allowed"
                htmlFor="plusOnesAllowed"
                hint="Guests name their plus-one when they RSVP."
                error={state?.errors?.plusOnesAllowed}
              >
                <Input
                  id="plusOnesAllowed"
                  name="plusOnesAllowed"
                  type="number"
                  min={0}
                  max={5}
                  defaultValue={String(initialHousehold?.plusOnesAllowed ?? 0)}
                  invalid={!!state?.errors?.plusOnesAllowed}
                  className="max-w-[8rem]"
                />
              </Field>
            </div>

            {/* Postal address */}
            <div className="space-y-4 border-t border-line pt-5">
              <h3 className="text-sm font-semibold text-ink">Postal address</h3>
              <Field label="Address line 1" htmlFor="addressLine1" optional>
                <Input
                  id="addressLine1"
                  name="addressLine1"
                  defaultValue={initialHousehold?.addressLine1 ?? ""}
                  placeholder="Street address"
                />
              </Field>
              <Field label="Address line 2" htmlFor="addressLine2" optional>
                <Input
                  id="addressLine2"
                  name="addressLine2"
                  defaultValue={initialHousehold?.addressLine2 ?? ""}
                  placeholder="Unit, apartment, building"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="city" optional>
                  <Input id="city" name="city" defaultValue={initialHousehold?.city ?? ""} placeholder="e.g. Sydney" />
                </Field>
                <Field label="State" htmlFor="region" optional>
                  <Input id="region" name="region" defaultValue={initialHousehold?.region ?? ""} placeholder="e.g. NSW" />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Postcode" htmlFor="postcode" optional>
                  <Input
                    id="postcode"
                    name="postcode"
                    defaultValue={initialHousehold?.postcode ?? ""}
                    placeholder="e.g. 2000"
                  />
                </Field>
                <Field label="Country" htmlFor="country" optional>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={initialHousehold?.country ?? ""}
                    placeholder="e.g. Australia"
                  />
                </Field>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-line pt-5">
              <Field label="Notes" htmlFor="notes" optional hint="Only visible to you and your co-hosts.">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={initialHousehold?.notes ?? ""}
                  placeholder="Any helpful details about this household"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <SubmitButton pendingLabel={mode === "create" ? "Adding…" : "Saving…"}>
                {mode === "create" ? "Add household" : "Save household"}
              </SubmitButton>
            </div>
          </form>

          {/* Named plus-ones (read-only, separate forms to avoid nesting) */}
          {mode === "edit" && householdId && plusOnes.length > 0 && (
            <div className="mt-6 max-w-2xl space-y-3 border-t border-line pt-5">
              <div>
                <h3 className="text-sm font-semibold text-ink">Named plus-ones</h3>
                <p className="text-xs text-ink-muted">
                  Added by the household when they RSVPed. Plus-ones inherit invitations from the household’s main guests.
                </p>
              </div>
              <ul className="divide-y divide-line rounded-xl border border-line bg-canvas/50">
                {plusOnes.map((po) => (
                  <li key={po.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-ink">
                        {po.firstName} {po.lastName}
                      </span>
                      <Badge tone="brand">Plus-one</Badge>
                    </div>
                    <form action={removePlusOneAction}>
                      <input type="hidden" name="householdId" value={householdId} />
                      <input type="hidden" name="guestId" value={po.id} />
                      <ConfirmButton
                        variant="danger"
                        size="sm"
                        confirm={`Remove ${po.firstName} ${po.lastName} from this household? Their RSVP answers will also be removed.`}
                      >
                        Remove plus-one
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Delete household */}
          {mode === "edit" && householdId && (
            <div className="mt-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <div>
                <p className="text-sm font-medium text-ink">Delete this household</p>
                <p className="text-xs text-ink-muted">
                  Removes all guests, RSVP responses and activity for this household.
                </p>
              </div>
              <form action={deleteHouseholdAction}>
                <input type="hidden" name="householdId" value={householdId} />
                <ConfirmButton
                  variant="danger"
                  size="sm"
                  confirm="Delete this household and all its guests and RSVP responses? This can’t be undone."
                >
                  Delete household
                </ConfirmButton>
              </form>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
