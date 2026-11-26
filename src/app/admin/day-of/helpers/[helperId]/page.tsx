import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteHelperAction, newHelperLinkAction } from "@/app/admin/day-of/helpers/actions";
import { guestOptions } from "@/app/admin/day-of/helpers/guest-options";
import { HelperForm } from "@/components/admin/day-of/helper-form";
import { BackLink, Card, CardBody, CardHeader, ConfirmButton, CopyButton, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { helperUrl, loadAssignments } from "@/lib/run-sheet-data";

export default async function EditHelperPage({ params }: PageProps<"/admin/day-of/helpers/[helperId]">) {
  const { wedding } = await requireHost();
  const { helperId } = await params;
  const [[helper], guests, assignments] = await Promise.all([
    db
      .select()
      .from(schema.helpers)
      .where(and(eq(schema.helpers.id, helperId), eq(schema.helpers.weddingId, wedding.id)))
      .limit(1),
    guestOptions(wedding.id),
    loadAssignments(wedding.id),
  ]);
  if (!helper) notFound();
  const count = assignments.filter((a) => a.helperId === helper.id).length;
  const link = helperUrl(helper.token);

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href="/admin/day-of/helpers">Helpers</BackLink>}
        title={helper.name}
        actions={
          <form action={deleteHelperAction}>
            <input type="hidden" name="id" value={helper.id} />
            <input type="hidden" name="redirectTo" value="list" />
            <ConfirmButton
              confirm={`Delete ${helper.name}?`}
              detail={`${count ? `Taken off ${count === 1 ? "1 job" : `${count} jobs`}, and their` : "Their"} page link will stop working.`}
            >
              Delete helper
            </ConfirmButton>
          </form>
        }
      />

      <Card>
        <CardBody>
          <HelperForm
            helper={{ id: helper.id, name: helper.name, role: helper.role, email: helper.email, phone: helper.phone }}
            guests={guests}
            returnTo="/admin/day-of/helpers"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Their page" description="Anyone with this link can see this helper's jobs. Make a new one if it was shared by mistake." />
        <CardBody className="space-y-3">
          <p className="font-mono text-xs break-all text-ink">{link}</p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={link} label="Copy link" />
            <a href={`/helper/${helper.token}`} target="_blank" rel="noreferrer" className="px-2 text-sm font-medium text-brand hover:underline">
              Open ↗
            </a>
            <form action={newHelperLinkAction}>
              <input type="hidden" name="id" value={helper.id} />
              <ConfirmButton
                variant="secondary"
                confirm={`Make a new link for ${helper.name}?`}
                detail="The old link stops working straight away. You'll need to send them the new one."
                confirmLabel="Make new link"
              >
                Make a new link
              </ConfirmButton>
            </form>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
