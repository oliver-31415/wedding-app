import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { DietaryDonut, DietaryLegend, dietarySlices } from "@/components/admin/rsvp/dietary-chart";
import { RsvpSubNav } from "@/components/admin/rsvp/rsvp-sub-nav";
import {
  BarList,
  Card,
  CardBody,
  CardHeader,
  CopyButton,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { describeQuestionConditions } from "@/lib/rsvp-admin/conditions";
import { dietaryGroup, dietaryNeedLabel, hasNoNeeds } from "@/lib/rsvp/dietary";
import { loadSnapshot } from "@/lib/snapshot";
import { computeStats } from "@/lib/stats";

export const metadata: Metadata = { title: "Dietary requirements" };

export default async function DietaryPage() {
  const { wedding } = await requireHost();
  const [snapshot, weddingTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);
  const stats = computeStats(snapshot);
  const row = stats.questions.find((q) => q.type === "dietary");
  const question = row && snapshot.questions.find((q) => q.id === row.questionId);

  const header = (
    <>
      <PageHeader title="RSVPs" description="Who needs what to eat, from your guests' RSVPs." />
      <RsvpSubNav current="/admin/rsvp/dietary" />
    </>
  );

  if (!row?.dietary || !question) {
    return (
      <div>
        {header}
        <EmptyState
          title="You're not asking about dietary requirements yet"
          body="Add it to your RSVP form and each guest ticks what applies to them (vegetarian, gluten free, allergies and so on). You'll see the totals here as a chart, with who needs what."
          action={
            <LinkButton href="/admin/rsvp/questions/new?type=dietary" variant="primary">
              Ask about dietary requirements
            </LinkButton>
          }
        />
      </div>
    );
  }

  const d = row.dietary;
  const slices = dietarySlices(d);
  const lookups = {
    eventsById: new Map(snapshot.events.map((e) => [e.id, { id: e.id, name: e.name, rsvpEnabled: e.rsvpEnabled }])),
    questionsById: new Map(
      snapshot.questions.map((q) => [q.id, { id: q.id, label: q.label, options: q.options, archived: q.archived }]),
    ),
    tagsById: new Map(weddingTags.map((t) => [t.id, t.name])),
  };

  // People with needs, grouped the same way as the chart.
  const order = new Map(d.groups.map((g, i) => [g.key, i]));
  const withNeeds = d.people
    .filter((p) => p.answer && !hasNoNeeds(p.answer))
    .sort(
      (a, b) =>
        order.get(dietaryGroup(a.answer!).key)! - order.get(dietaryGroup(b.answer!).key)! || a.who.localeCompare(b.who, "en-AU"),
    );
  const noNeeds = d.people.filter((p) => p.answer && hasNoNeeds(p.answer));
  const pending = d.people.filter((p) => !p.answer);

  // Plain text to send the caterer.
  const forCaterer = [
    `Dietary requirements — ${wedding.partnerOne} & ${wedding.partnerTwo}`,
    `${d.people.length} ${d.people.length === 1 ? "guest" : "guests"} asked · ${d.withNeeds} with requirements · ${noNeeds.length} with none${pending.length ? ` · ${pending.length} yet to answer` : ""}`,
    "",
    ...d.groups
      .filter((g) => g.key !== "none")
      .flatMap((g) => [
        `${g.label}: ${g.count}`,
        ...withNeeds
          .filter((p) => dietaryGroup(p.answer!).key === g.key)
          .map((p) => `  - ${p.who}${p.answer!.note ? ` (${p.answer!.note})` : ""}`),
      ]),
  ].join("\n");

  return (
    <div>
      {header}
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={question.label}
            description={describeQuestionConditions(question, lookups).join(" · ")}
            actions={
              <span className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-ink-muted tabular-nums">
                  Answered {row.answered} of {row.asked} asked
                </span>
                <LinkButton href={`/admin/rsvp/questions/${question.id}`} variant="ghost" size="sm">
                  Edit question
                </LinkButton>
              </span>
            }
          />
          <CardBody>
            {row.asked === 0 ? (
              <p className="text-sm text-ink-muted">
                Nobody has been asked yet. Guests answer when they RSVP that they&apos;re coming.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                <DietaryDonut slices={slices} withNeeds={d.withNeeds} />
                <DietaryLegend slices={slices} />
              </div>
            )}
          </CardBody>
        </Card>

        {d.needs.length > 0 && (
          <Card>
            <CardHeader
              title="By requirement"
              description="How many people need each one. Someone who is vegan and gluten free counts in both."
            />
            <CardBody>
              <BarList rows={d.needs.map((n) => ({ label: n.label, value: n.count }))} />
              {d.groups.some((g) => g.key === "other") && (
                <p className="mt-3 text-sm text-ink-muted">
                  {d.groups.find((g) => g.key === "other")!.count} more only wrote a note; see the list below.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Who needs what"
            description={
              withNeeds.length
                ? "The copied list groups people by their exact combination, ready to send to your caterer."
                : "Nobody has listed a dietary requirement yet."
            }
            actions={withNeeds.length > 0 && <CopyButton text={forCaterer} label="Copy list for the caterer" />}
          />
          {withNeeds.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Guest</Th>
                  <Th>Requirements</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {withNeeds.map((p) => (
                  <tr key={p.guestId}>
                    <Td>
                      <Link href={`/admin/guests/${p.householdId}`} className="font-medium text-ink hover:text-brand hover:underline">
                        {p.who}
                      </Link>
                    </Td>
                    <Td>
                      {p.answer!.needs.length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {p.answer!.needs.map((n) => (
                            <span key={n} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-strong">
                              {dietaryNeedLabel(n)}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-ink-muted">Other</span>
                      )}
                    </Td>
                    <Td className="text-ink-muted">{p.answer!.note ?? ""}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {(pending.length > 0 || noNeeds.length > 0) && (
            <CardBody className="space-y-3 text-sm">
              {pending.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-medium text-ink select-none">
                    Not answered yet ({pending.length})
                  </summary>
                  <p className="mt-2 text-ink-muted">
                    Coming, but haven&apos;t said. You can fill it in for them on their household&apos;s page.
                  </p>
                  <PeopleList people={pending} />
                </details>
              )}
              {noNeeds.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-medium text-ink select-none">
                    No requirements ({noNeeds.length})
                  </summary>
                  <PeopleList people={noNeeds} />
                </details>
              )}
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}

function PeopleList({ people }: { people: { guestId: string; householdId: string; who: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {[...people]
        .sort((a, b) => a.who.localeCompare(b.who, "en-AU"))
        .map((p) => (
          <li key={p.guestId}>
            <Link href={`/admin/guests/${p.householdId}`} className="text-ink hover:text-brand hover:underline">
              {p.who}
            </Link>
          </li>
        ))}
    </ul>
  );
}
