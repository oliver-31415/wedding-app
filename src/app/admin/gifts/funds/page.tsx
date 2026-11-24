import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  LinkButton,
  Progress,
  ReorderButtons,
  TextBlock,
} from "@/components/ui";
import { GiftsChrome } from "@/components/admin/gifts/gifts-chrome";
import { RecordGiftForm } from "@/components/admin/gifts/record-gift-form";
import { requireHost } from "@/lib/auth";
import { formatDateShort, todayIn } from "@/lib/dates";
import { loadAdminGiftBundle } from "@/lib/gift-admin/data";
import { fundProgress } from "@/lib/gifts";
import { formatMoney } from "@/lib/money";
import {
  deleteCashFundAction,
  deleteContributionAction,
  reorderCashFundsAction,
  toggleContributionReceivedAction,
  toggleContributionThankedAction,
} from "../actions";

export default async function AdminCashFundsPage() {
  const { wedding } = await requireHost();
  const { items, funds, contributions, summary } = await loadAdminGiftBundle(wedding.id);

  return (
    <div>
      <GiftsChrome
        current="/admin/gifts/funds"
        summary={summary}
        currency={wedding.currency}
        actions={
          <>
            {(items.length > 0 || funds.length > 0) && (
              <a
                href="#record-gift"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:bg-sunken"
              >
                Record a gift
              </a>
            )}
            <LinkButton variant="primary" href="/admin/gifts/funds/new">
              Add cash fund
            </LinkButton>
          </>
        }
      />

      <div className="space-y-6">
        {funds.length === 0 ? (
          <EmptyState
            title="No cash funds yet"
            body="Your gift list starts empty and guests only see what you add here. Add a cash fund with your own PayID or bank details — money goes straight to you."
            action={
              <LinkButton variant="primary" href="/admin/gifts/funds/new">
                Add cash fund
              </LinkButton>
            }
          />
        ) : (
          <div className="space-y-4">
            {funds.map((fund, idx) => {
              const fundContribs = contributions.filter((c) => c.fundId === fund.id);
              const progress = fundProgress(fund, contributions);
              const confirmMsg =
                fundContribs.length > 0
                  ? `Delete “${fund.name}”? ${
                      fundContribs.length === 1
                        ? "1 recorded contribution"
                        : `${fundContribs.length} recorded contributions`
                    } will also be deleted. Consider hiding this fund instead if you want to keep your records.`
                  : `Delete “${fund.name}”?`;

              return (
                <Card key={fund.id}>
                  <CardHeader
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{fund.name}</span>
                        {fund.hidden && <Badge tone="neutral">Hidden</Badge>}
                      </span>
                    }
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <ReorderButtons
                          id={fund.id}
                          action={reorderCashFundsAction}
                          isFirst={idx === 0}
                          isLast={idx === funds.length - 1}
                          label={fund.name}
                        />
                        <LinkButton size="sm" variant="secondary" href={`/admin/gifts/funds/${fund.id}`}>
                          Edit
                        </LinkButton>
                        <form action={deleteCashFundAction}>
                          <input type="hidden" name="id" value={fund.id} />
                          <ConfirmButton confirm={confirmMsg}>Delete</ConfirmButton>
                        </form>
                      </div>
                    }
                  />
                  <CardBody className="space-y-5">
                    {fund.description && (
                      <TextBlock text={fund.description} className="text-sm text-ink-muted" />
                    )}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-ink tabular-nums">
                          {fund.goalCents
                            ? `${formatMoney(progress.pledgedCents, wedding.currency)} pledged of ${formatMoney(fund.goalCents, wedding.currency)} goal`
                            : `${formatMoney(progress.pledgedCents, wedding.currency)} pledged`}
                        </span>
                        <span className="text-ink-muted tabular-nums">
                          received {formatMoney(progress.receivedCents, wedding.currency)}
                        </span>
                      </div>
                      {fund.goalCents != null && fund.goalCents > 0 && (
                        <Progress
                          value={progress.pledgedCents}
                          max={fund.goalCents}
                          tone={progress.pledgedCents >= fund.goalCents ? "good" : "brand"}
                          label={`${fund.name} progress`}
                        />
                      )}
                    </div>

                    {(fund.paymentInstructions || fund.paymentUrl) && (
                      <div className="rounded-lg border border-line bg-sunken/60 px-4 py-3 text-sm">
                        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                          Payment details shown to guests
                        </p>
                        {fund.paymentInstructions && (
                          <TextBlock text={fund.paymentInstructions} className="mt-1.5 text-ink" />
                        )}
                        {fund.paymentUrl && (
                          <p className="mt-1.5">
                            <a
                              href={fund.paymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand hover:underline"
                            >
                              {fund.paymentUrl} ↗
                            </a>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <h3 className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                        Contributions ({fundContribs.length})
                      </h3>
                      {fundContribs.length === 0 ? (
                        <p className="text-sm text-ink-muted">No pledges or contributions yet.</p>
                      ) : (
                        <ul className="divide-y divide-line rounded-lg border border-line">
                          {fundContribs.map((c) => (
                            <li
                              key={c.id}
                              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-ink">{c.giverName}</span>
                                  <span className="font-medium text-ink tabular-nums">
                                    {formatMoney(c.amountCents, wedding.currency)}
                                  </span>
                                  {c.received ? (
                                    <Badge tone="good">Received</Badge>
                                  ) : (
                                    <Badge tone="warn">Pledged</Badge>
                                  )}
                                  {c.thankedAt ? (
                                    <Badge tone="good">Thanked</Badge>
                                  ) : (
                                    <Badge tone="warn">To thank</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-ink-muted">
                                  {formatDateShort(todayIn(wedding.timeZone, c.createdAt.getTime()))}
                                </p>
                                {c.message && (
                                  <TextBlock text={c.message} className="pt-1 text-sm text-ink-muted" />
                                )}
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <form action={toggleContributionReceivedAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <Button type="submit" size="sm" variant="secondary">
                                    {c.received ? "Mark pledged" : "Mark received"}
                                  </Button>
                                </form>
                                <form action={toggleContributionThankedAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <Button type="submit" size="sm" variant="secondary">
                                    {c.thankedAt ? "Unmark thanked" : "Mark thanked"}
                                  </Button>
                                </form>
                                <form action={deleteContributionAction}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <ConfirmButton
                                    confirm={`Delete this ${formatMoney(c.amountCents, wedding.currency)} contribution from ${c.giverName}?`}
                                  >
                                    Delete
                                  </ConfirmButton>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        <div id="record-gift" className="scroll-mt-6">
          <Card>
            <CardHeader
              title="Record a gift"
              description="Log a gift or cash contribution given offline. Cash fund gifts recorded here are marked as received straight away."
            />
            <CardBody>
              <RecordGiftForm
                items={items.map((i) => ({ id: i.id, name: i.name }))}
                funds={funds.map((f) => ({ id: f.id, name: f.name }))}
                currency={wedding.currency}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
