import Link from "next/link";
import {
  Button,
  ConfirmButton,
  PledgeBadge,
  ThankedBadge,
  Card,
  CardBody,
  EmptyState,
  LinkButton,
  Table,
  Td,
  TextBlock,
  Th,
  cn,
} from "@/components/ui";
import { CopyListButton } from "@/components/admin/gifts/copy-list-button";
import { GiftsChrome } from "@/components/admin/gifts/gifts-chrome";
import { requireHost } from "@/lib/auth";
import { formatDateShort, todayIn } from "@/lib/dates";
import { loadAdminGiftBundle } from "@/lib/gift-admin/data";
import {
  buildReceivedEntries,
  filterReceivedEntries,
  formatThankYouCopyList,
  parseReceivedFilter,
  type ReceivedFilter,
} from "@/lib/gift-admin/helpers";
import { formatMoney } from "@/lib/money";
import {
  deleteClaimAction,
  deleteContributionAction,
  toggleClaimThankedAction,
  toggleContributionReceivedAction,
  toggleContributionThankedAction,
} from "../actions";

export default async function AdminGiftsReceivedPage({
  searchParams,
}: PageProps<"/admin/gifts/received">) {
  const { wedding } = await requireHost();
  const params = await searchParams;
  const rawFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const filter: ReceivedFilter = parseReceivedFilter(rawFilter);

  const { items, claims, funds, contributions, summary } = await loadAdminGiftBundle(wedding.id);
  const allEntries = buildReceivedEntries({ items, claims, funds, contributions });
  const visibleEntries = filterReceivedEntries(allEntries, filter);
  const toThankCount = filterReceivedEntries(allEntries, "to_thank").length;
  const pledgedCount = filterReceivedEntries(allEntries, "pledged").length;
  const copyText = formatThankYouCopyList(visibleEntries, wedding.currency);

  const filters: Array<{ key: ReceivedFilter; label: string; count: number; href: string }> = [
    { key: "all", label: "All", count: allEntries.length, href: "/admin/gifts/received" },
    {
      key: "to_thank",
      label: "To thank",
      count: toThankCount,
      href: "/admin/gifts/received?filter=to_thank",
    },
    {
      key: "pledged",
      label: "Pledged",
      count: pledgedCount,
      href: "/admin/gifts/received?filter=pledged",
    },
  ];

  return (
    <div>
      <GiftsChrome
        current="/admin/gifts/received"
        summary={summary}
        currency={wedding.currency}
        actions={
          <>
            <CopyListButton text={copyText} label="Copy list" />
            <LinkButton variant="secondary" href="/admin/gifts/funds#record-gift">
              Record a gift
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Filter received gifts">
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Link
                key={f.key}
                href={f.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-brand bg-brand-soft font-medium text-brand-strong"
                    : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span>{f.label}</span>
                <span className="text-xs opacity-80 tabular-nums">{f.count}</span>
              </Link>
            );
          })}
        </div>
        {visibleEntries.length > 0 && (
          <p className="text-xs text-ink-muted">
            Copy list copies the {visibleEntries.length === 1 ? "1 gift" : `${visibleEntries.length} gifts`} shown below for writing thank-you cards.
          </p>
        )}
      </div>

      {visibleEntries.length === 0 ? (
        <EmptyState
          title={
            allEntries.length === 0
              ? "No gifts recorded yet"
              : filter === "to_thank"
                ? "Everyone has been thanked"
                : "No outstanding pledges"
          }
          body={
            allEntries.length === 0
              ? "When guests claim an item, pledge to a cash fund, or you record an offline gift, it will appear here."
              : filter === "to_thank"
                ? "All recorded gifts and contributions are marked as thanked."
                : "Every cash fund contribution has been marked as received."
          }
          action={
            allEntries.length === 0 ? (
              <LinkButton variant="primary" href="/admin/gifts/funds#record-gift">
                Record a gift
              </LinkButton>
            ) : (
              <LinkButton variant="secondary" href="/admin/gifts/received">
                Show all gifts
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-3 md:hidden">
            {visibleEntries.map((entry) => {
              const dateLabel = formatDateShort(todayIn(wedding.timeZone, entry.createdAt.getTime()));
              const thankAction =
                entry.kind === "claim" ? toggleClaimThankedAction : toggleContributionThankedAction;
              return (
                <Card key={`${entry.kind}-${entry.id}`}>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{entry.giverName}</p>
                        {entry.giverEmail && (
                          <p className="truncate text-xs text-ink-muted">{entry.giverEmail}</p>
                        )}
                        <p className="mt-1 text-sm text-ink">
                          {entry.what}
                          {entry.kind === "claim" ? (
                            <span className="ml-1.5 text-ink-muted">
                              {entry.quantity > 1 ? `× ${entry.quantity}` : "(1)"}
                            </span>
                          ) : (
                            <span className="ml-1.5 font-medium tabular-nums">
                              {formatMoney(entry.amountCents, wedding.currency)}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">{dateLabel}</p>
                      </div>
                    </div>

                    {entry.message && (
                      <TextBlock text={entry.message} className="text-sm text-ink-muted" />
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {entry.kind === "contribution" && (
                        <PledgeBadge received={entry.received} />
                      )}
                      <ThankedBadge thanked={!!entry.thankedAt} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {entry.kind === "contribution" && (
                        <form action={toggleContributionReceivedAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            {entry.received ? "Mark pledged" : "Mark received"}
                          </Button>
                        </form>
                      )}
                      <form action={thankAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          {entry.thankedAt ? "Unmark thanked" : "Mark thanked"}
                        </Button>
                      </form>
                      <form action={entry.kind === "claim" ? deleteClaimAction : deleteContributionAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <ConfirmButton
                          confirm={`Delete ${entry.giverName}’s ${entry.kind === "claim" ? "gift" : "contribution"}?`}
                          detail="Use this for mistakes or entries you don’t recognise. The item becomes available again on your gift list."
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Giver</Th>
                  <Th>Gift</Th>
                  <Th>Amount / qty</Th>
                  <Th>Message</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => {
                  const dateLabel = formatDateShort(todayIn(wedding.timeZone, entry.createdAt.getTime()));
                  const thankAction =
                    entry.kind === "claim" ? toggleClaimThankedAction : toggleContributionThankedAction;
                  return (
                    <tr key={`${entry.kind}-${entry.id}`}>
                      <Td>
                        <p className="font-medium text-ink">{entry.giverName}</p>
                        {entry.giverEmail && (
                          <p className="text-xs text-ink-muted">{entry.giverEmail}</p>
                        )}
                      </Td>
                      <Td className="text-ink">{entry.what}</Td>
                      <Td className="whitespace-nowrap font-medium text-ink tabular-nums">
                        {entry.kind === "claim"
                          ? entry.quantity > 1
                            ? `× ${entry.quantity}`
                            : "1"
                          : formatMoney(entry.amountCents, wedding.currency)}
                      </Td>
                      <Td className="max-w-xs text-ink-muted">
                        {entry.message ? (
                          <TextBlock text={entry.message} className="text-sm" />
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-ink-muted">{dateLabel}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.kind === "contribution" && (
                            <PledgeBadge received={entry.received} />
                          )}
                          <ThankedBadge thanked={!!entry.thankedAt} />
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {entry.kind === "contribution" && (
                            <form action={toggleContributionReceivedAction}>
                              <input type="hidden" name="id" value={entry.id} />
                              <Button type="submit" size="sm" variant="secondary">
                                {entry.received ? "Mark pledged" : "Mark received"}
                              </Button>
                            </form>
                          )}
                          <form action={thankAction}>
                            <input type="hidden" name="id" value={entry.id} />
                            <Button type="submit" size="sm" variant="secondary">
                              {entry.thankedAt ? "Unmark thanked" : "Mark thanked"}
                            </Button>
                          </form>
                          <form action={entry.kind === "claim" ? deleteClaimAction : deleteContributionAction}>
                            <input type="hidden" name="id" value={entry.id} />
                            <ConfirmButton
                              confirm={`Delete ${entry.giverName}’s ${entry.kind === "claim" ? "gift" : "contribution"}?`}
                              detail="Use this for mistakes or entries you don’t recognise. The item becomes available again on your gift list."
                            >
                              Delete
                            </ConfirmButton>
                          </form>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
