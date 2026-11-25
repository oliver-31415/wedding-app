import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { deleteRunItemAction } from "@/app/admin/day-of/actions";
import { PrintButton, RunItemForm } from "@/components/admin/day-of/forms";
import { DayOfSubNav } from "@/components/admin/day-of/sub-nav";
import { Card, CardBody, CardHeader, ConfirmButton, EmptyState, PageHeader, TextBlock } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { formatClock, sortRunSheet } from "@/lib/planning";

export const metadata: Metadata = { title: "Day of" };

export default async function RunSheetPage() {
  const { wedding } = await requireHost();
  const items = sortRunSheet(await db.select().from(schema.runSheetItems).where(eq(schema.runSheetItems.weddingId, wedding.id)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Run sheet"
        description={`The day, minute by minute${wedding.date ? ` — ${formatDateLong(wedding.date)}` : ""}. Print it or share it with your vendors and wedding party. Guests never see it.`}
        actions={items.length > 0 ? <PrintButton /> : undefined}
      />
      <DayOfSubNav current="/admin/day-of" />

      {items.length === 0 ? (
        <EmptyState title="Nothing on the run sheet yet" body="Add everything from hair and makeup to the last dance, with who’s responsible for each part." />
      ) : (
        <Card>
          <ol className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="grid grid-cols-[5.5rem_1fr] gap-3 px-5 py-4">
                <p className="font-medium text-ink tabular-nums">{item.time ? formatClock(item.time) : "—"}</p>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{item.title}</p>
                  {(item.location || item.who) && <p className="text-sm text-ink-muted">{[item.location, item.who].filter(Boolean).join(" · ")}</p>}
                  {item.notes && (
                    <div className="text-sm text-ink-muted">
                      <TextBlock text={item.notes} />
                    </div>
                  )}
                  <details className="print:hidden">
                    <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Edit</summary>
                    <div className="mt-3 space-y-3">
                      <RunItemForm item={item} />
                      <form action={deleteRunItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmButton confirm={`Delete “${item.title}”?`}>Delete</ConfirmButton>
                      </form>
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card className="print:hidden">
        <CardHeader title="Add to the run sheet" description="Items sort themselves by time." />
        <CardBody>
          <RunItemForm />
        </CardBody>
      </Card>
    </div>
  );
}
