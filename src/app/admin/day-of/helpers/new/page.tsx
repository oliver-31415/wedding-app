import { guestOptions, returnPath } from "@/app/admin/day-of/helpers/guest-options";
import { HelperForm } from "@/components/admin/day-of/helper-form";
import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { requireHost } from "@/lib/auth";

export default async function NewHelperPage({ searchParams }: PageProps<"/admin/day-of/helpers/new">) {
  const { wedding } = await requireHost();
  const returnTo = returnPath((await searchParams).returnTo);
  const guests = await guestOptions(wedding.id);

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href={returnTo}>{returnTo === "/admin/day-of" ? "Run sheet" : "Helpers"}</BackLink>}
        title="Add helper"
        description="Someone doing jobs on the day. They get their own page listing their jobs."
      />
      <Card>
        <CardBody>
          <HelperForm guests={guests} returnTo={returnTo} />
        </CardBody>
      </Card>
    </div>
  );
}
