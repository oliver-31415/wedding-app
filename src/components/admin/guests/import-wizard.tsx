"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  LinkButton,
  Notice,
  SubmitButton,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { confirmImportAction } from "@/app/admin/guests/import/actions";
import {
  IMPORT_HEADERS,
  parseGuestCsv,
  selectImportHouseholds,
  type ExistingGuestRef,
  type ExistingTagRef,
} from "@/lib/guests/csv";

export function ImportWizard({
  existingGuests,
  existingTags,
}: {
  existingGuests: ExistingGuestRef[];
  existingTags: ExistingTagRef[];
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [includedDuplicates, setIncludedDuplicates] = useState<Set<number>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importState, formAction] = useActionState(confirmImportAction, null);

  const parsed = useMemo(() => {
    if (csvText === null) return null;
    return parseGuestCsv(csvText, existingGuests);
  }, [csvText, existingGuests]);

  const selected = useMemo(() => {
    if (!parsed || parsed.fatalError) return null;
    return selectImportHouseholds(parsed, includedDuplicates, existingTags);
  }, [parsed, includedDuplicates, existingTags]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
    setIncludedDuplicates(new Set());
  }

  function toggleDuplicate(rowNumber: number) {
    setIncludedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function resetUpload() {
    setFileName(null);
    setCsvText(null);
    setIncludedDuplicates(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (importState?.ok) {
    const s = importState.summary;
    return (
      <Card>
        <CardHeader title="Import complete" />
        <CardBody className="space-y-4">
          <Notice tone="good" title="Your guests have been added">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                {s.guestsCreated} {s.guestsCreated === 1 ? "guest" : "guests"} added across {s.householdsCreated}{" "}
                {s.householdsCreated === 1 ? "household" : "households"}
              </li>
              {s.tagsCreated > 0 && (
                <li>
                  {s.tagsCreated} new {s.tagsCreated === 1 ? "tag" : "tags"} created
                </li>
              )}
              {s.skippedDuplicates > 0 && (
                <li>
                  {s.skippedDuplicates} possible {s.skippedDuplicates === 1 ? "duplicate" : "duplicates"} skipped
                </li>
              )}
              {s.skippedErrors > 0 && (
                <li>
                  {s.skippedErrors} {s.skippedErrors === 1 ? "row" : "rows"} skipped due to errors
                </li>
              )}
            </ul>
          </Notice>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/admin/guests" variant="primary">
              View guest list
            </LinkButton>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Import another file
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      <Card>
        <CardHeader
          title="1. Upload your CSV"
          description="Rows with the same Household name are grouped into one household. Leave Household blank for a household of one."
        />
        <CardBody className="space-y-4">
          <div className="space-y-2 text-sm text-ink-muted">
            <p>
              <strong className="font-medium text-ink">Recognised columns:</strong>{" "}
              {IMPORT_HEADERS.join(", ")}. Headers are case-insensitive and extra columns are ignored.
            </p>
            <p>
              Separate multiple tags with <code className="rounded bg-sunken px-1 py-0.5 text-xs">;</code> or{" "}
              <code className="rounded bg-sunken px-1 py-0.5 text-xs">|</code> — any missing tags will be created.
              Plus-ones, address and notes are taken from the first row of each household.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleFileChange(e)}
              className="block w-full max-w-sm text-sm text-ink file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken"
            />
            {fileName && (
              <Button variant="ghost" size="sm" onClick={resetUpload}>
                Clear file
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Fatal CSV error */}
      {parsed?.fatalError && <Notice tone="bad" title="Could not read CSV">{parsed.fatalError}</Notice>}

      {/* Server error on confirm */}
      {importState && !importState.ok && <Notice tone="bad">{importState.message}</Notice>}

      {/* Step 1 preview */}
      {parsed && !parsed.fatalError && selected && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader
              title="2. Preview & confirm"
              description={fileName ? `Reviewing ${fileName}` : undefined}
            />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone="good">
                  {selected.households.length}{" "}
                  {selected.households.length === 1 ? "household" : "households"} to create
                </Badge>
                <Badge tone="good">
                  {selected.guestCount} {selected.guestCount === 1 ? "guest" : "guests"} to import
                </Badge>
                {parsed.duplicates.length > 0 && (
                  <Badge tone="warn">
                    {selected.skippedDuplicates} {selected.skippedDuplicates === 1 ? "duplicate" : "duplicates"} skipped
                  </Badge>
                )}
                {parsed.errors.length > 0 && (
                  <Badge tone="bad">
                    {parsed.errors.length} {parsed.errors.length === 1 ? "row error" : "row errors"}
                  </Badge>
                )}
              </div>

              {selected.newTagNames.length > 0 && (
                <Notice tone="info">
                  New tags that will be created: <strong>{selected.newTagNames.join(", ")}</strong>
                </Notice>
              )}

              {/* Row errors */}
              {parsed.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-bad">
                    Rows with errors ({parsed.errors.length} — will be skipped)
                  </h3>
                  <div className="rounded-xl border border-bad/30">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Row</Th>
                          <Th>Name</Th>
                          <Th>Problem</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.errors.map((err) => (
                          <tr key={err.rowNumber}>
                            <Td className="tabular-nums text-ink-muted">{err.rowNumber}</Td>
                            <Td className="font-medium text-ink">{err.name}</Td>
                            <Td className="text-bad">{err.messages.join(" ")}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Possible duplicates */}
              {parsed.duplicates.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-warn">
                    Possible duplicates ({parsed.duplicates.length})
                  </h3>
                  <p className="text-sm text-ink-muted">
                    These guests match someone already on your list and are skipped by default. Tick any row you want to
                    import anyway.
                  </p>
                  <div className="rounded-xl border border-line">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Import anyway</Th>
                          <Th>Row</Th>
                          <Th>CSV guest</Th>
                          <Th>Existing match</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.duplicates.map((dup) => (
                          <tr key={dup.rowNumber}>
                            <Td>
                              <Checkbox
                                label="Import"
                                checked={includedDuplicates.has(dup.rowNumber)}
                                onChange={() => toggleDuplicate(dup.rowNumber)}
                              />
                            </Td>
                            <Td className="tabular-nums text-ink-muted">{dup.rowNumber}</Td>
                            <Td className="font-medium text-ink">
                              {dup.firstName} {dup.lastName}
                              {dup.householdName && (
                                <span className="block text-xs font-normal text-ink-muted">{dup.householdName}</span>
                              )}
                            </Td>
                            <Td className="text-ink-muted">
                              {dup.duplicateOf?.name}
                              {dup.duplicateOf?.householdLabel && (
                                <span className="block text-xs">in {dup.duplicateOf.householdLabel}</span>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Households to create */}
              {selected.households.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-ink">
                    Households to create ({selected.households.length})
                  </h3>
                  <div className="rounded-xl border border-line">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Household</Th>
                          <Th>Members</Th>
                          <Th>Plus-ones</Th>
                          <Th>Address</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.households.map((h) => {
                          const addr = [h.addressLine1, h.city, h.region, h.postcode, h.country]
                            .filter(Boolean)
                            .join(", ");
                          return (
                            <tr key={h.key}>
                              <Td className="font-medium text-ink">{h.displayLabel}</Td>
                              <Td>
                                <ul className="space-y-1">
                                  {h.members.map((m) => (
                                    <li key={m.rowNumber} className="flex flex-wrap items-center gap-1.5 text-sm">
                                      <span>
                                        {m.firstName} {m.lastName}
                                      </span>
                                      {m.ageGroup === "child" && <Badge tone="info">Child</Badge>}
                                      {m.email && <span className="text-xs text-ink-muted">{m.email}</span>}
                                      {m.tags.map((t) => (
                                        <Badge key={t} tone="neutral">
                                          {t}
                                        </Badge>
                                      ))}
                                    </li>
                                  ))}
                                </ul>
                              </Td>
                              <Td className="tabular-nums text-ink-muted">{h.plusOnesAllowed}</Td>
                              <Td className="text-xs text-ink-muted">{addr || "—"}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </div>
              ) : (
                <Notice tone="warn">
                  No households will be created from this file. Fix any row errors or tick duplicates above to include
                  them.
                </Notice>
              )}

              {/* Confirm form */}
              <form action={formAction} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <input type="hidden" name="csvText" value={csvText ?? ""} />
                <input
                  type="hidden"
                  name="includedDuplicateRows"
                  value={JSON.stringify([...includedDuplicates])}
                />
                <SubmitButton
                  disabled={selected.guestCount === 0}
                  pendingLabel="Importing…"
                >
                  {selected.guestCount > 0
                    ? `Import ${selected.guestCount} ${selected.guestCount === 1 ? "guest" : "guests"} in ${selected.households.length} ${selected.households.length === 1 ? "household" : "households"}`
                    : "Nothing to import"}
                </SubmitButton>
                <Button variant="secondary" onClick={resetUpload}>
                  Choose another file
                </Button>
              </form>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
