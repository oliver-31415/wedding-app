import Link from "next/link";
import { Badge, Card, CardBody } from "@/components/ui";
import { NAME_CHECKS_PATH } from "@/lib/name-checks";

/** Dashboard to-do: guests who couldn't find their invitation are waiting for you to check their name. */
export function NameChecksCard({ pending }: { pending: number }) {
  if (pending === 0) return null;
  return (
    <Card>
      <CardBody className="py-4">
        <Link href={NAME_CHECKS_PATH} className="group flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink group-hover:text-brand">
              {pending === 1 ? "1 guest asked you to check their name" : `${pending} guests asked you to check their name`}
              <Badge tone="warn">To do</Badge>
            </p>
            <p className="text-sm text-ink-muted">
              They couldn&apos;t find their invitation. Match them to someone on your guest list and we&apos;ll email them
              their link.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-brand group-hover:underline">Check →</span>
        </Link>
      </CardBody>
    </Card>
  );
}
