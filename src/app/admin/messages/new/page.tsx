import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { requireHost } from "@/lib/auth";
import { MESSAGE_KIND_META, MESSAGE_KIND_ORDER } from "@/lib/messaging/templates";
import { createDraftAction } from "./actions";

export default async function NewMessagePage() {
  await requireHost();
  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackLink href="/admin/messages">Messages</BackLink>}
        title="New message"
        description="Choose a starting point — you can edit every word before sending."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {MESSAGE_KIND_ORDER.map((kind) => {
          const meta = MESSAGE_KIND_META[kind];
          return (
            <form key={kind} action={createDraftAction}>
              <input type="hidden" name="kind" value={kind} />
              <button type="submit" className="group block h-full w-full text-left">
                <Card className="h-full transition-colors group-hover:border-brand group-focus-visible:border-brand">
                  <CardBody className="space-y-1.5">
                    <p className="font-medium text-ink group-hover:text-brand">{meta.label}</p>
                    <p className="text-sm text-ink-muted">{meta.description}</p>
                  </CardBody>
                </Card>
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
