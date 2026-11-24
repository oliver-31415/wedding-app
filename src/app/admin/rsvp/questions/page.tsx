import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { RsvpSubNav } from "@/components/admin/rsvp/rsvp-sub-nav";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmButton,
  EmptyState,
  LinkButton,
  PageHeader,
  ReorderButtons,
} from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import {
  describeQuestionConditions,
  describeQuestionRemovalConfirm,
} from "@/lib/rsvp-admin/conditions";
import { sortByPosition } from "@/lib/rsvp/model";
import { loadSnapshot } from "@/lib/snapshot";
import {
  archiveQuestion,
  deleteQuestion,
  reorderQuestion,
  restoreQuestion,
} from "./actions";

export default async function RsvpQuestionsPage() {
  const { wedding } = await requireHost();

  const [snapshot, weddingTags] = await Promise.all([
    loadSnapshot(wedding.id),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
  ]);

  const activeQuestions = sortByPosition(
    snapshot.questions.filter((q) => !q.archived),
  );
  const archivedQuestions = sortByPosition(
    snapshot.questions.filter((q) => q.archived),
  );

  // Stored answer counts determine whether a question can be deleted or must be archived.
  const storedAnswerCounts = new Map<string, number>();
  for (const a of snapshot.answers) {
    storedAnswerCounts.set(a.questionId, (storedAnswerCounts.get(a.questionId) ?? 0) + 1);
  }

  const activeFollowUpsByParent = new Map<string, string[]>();
  for (const q of activeQuestions) {
    if (!q.parentQuestionId) continue;
    const list = activeFollowUpsByParent.get(q.parentQuestionId);
    if (list) list.push(q.label);
    else activeFollowUpsByParent.set(q.parentQuestionId, [q.label]);
  }

  const lookups = {
    eventsById: new Map(
      snapshot.events.map((e) => [e.id, { id: e.id, name: e.name, rsvpEnabled: e.rsvpEnabled }]),
    ),
    questionsById: new Map(
      snapshot.questions.map((q) => [
        q.id,
        { id: q.id, label: q.label, options: q.options, archived: q.archived },
      ]),
    ),
    tagsById: new Map(weddingTags.map((t) => [t.id, t.name])),
  };

  return (
    <div>
      <PageHeader
        title="RSVP questions"
        description="Ask guests for meal choices, dietary requirements, song requests or anything else you need."
        actions={
          <LinkButton href="/admin/rsvp/questions/new" variant="primary">
            Add a question
          </LinkButton>
        }
      />

      <RsvpSubNav current="/admin/rsvp/questions" />

      <div className="space-y-6">
        {activeQuestions.length === 0 ? (
          <EmptyState
            title="No RSVP questions yet"
            body="Questions are optional. Add one when you want to collect details like meal choices, dietary requirements, or song requests alongside attendance."
            action={
              <LinkButton href="/admin/rsvp/questions/new" variant="primary">
                Add a question
              </LinkButton>
            }
          />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {activeQuestions.map((q, index) => {
                const answerCount = storedAnswerCounts.get(q.id) ?? 0;
                const followUps = activeFollowUpsByParent.get(q.id) ?? [];
                const conditions = describeQuestionConditions(q, lookups);

                return (
                  <li key={q.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/rsvp/questions/${q.id}`}
                            className="font-medium text-ink hover:text-brand hover:underline"
                          >
                            {q.label}
                          </Link>
                          <Badge tone="neutral">
                            {q.type === "choice" ? "Multiple choice" : "Short answer"}
                          </Badge>
                          <Badge tone="neutral">
                            {q.scope === "household" ? "Per household" : "Per guest"}
                          </Badge>
                          {q.required && <Badge tone="info">Required</Badge>}
                        </div>

                        <p className="text-sm text-ink-muted">
                          {conditions.join(" · ")}
                        </p>

                        {q.type === "choice" && q.options.length > 0 && (
                          <p className="text-xs text-ink-faint">
                            Options: {q.options.map((o) => o.label).join(" · ")}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <ReorderButtons
                          id={q.id}
                          action={reorderQuestion}
                          isFirst={index === 0}
                          isLast={index === activeQuestions.length - 1}
                          label={q.label}
                        />
                        <LinkButton
                          href={`/admin/rsvp/questions/${q.id}`}
                          variant="secondary"
                          size="sm"
                        >
                          Edit
                        </LinkButton>
                        {answerCount === 0 ? (
                          <form action={deleteQuestion}>
                            <input type="hidden" name="id" value={q.id} />
                            <ConfirmButton
                              confirm={describeQuestionRemovalConfirm(
                                q.label,
                                followUps,
                                "delete",
                              )}
                            >
                              Delete
                            </ConfirmButton>
                          </form>
                        ) : (
                          <form action={archiveQuestion}>
                            <input type="hidden" name="id" value={q.id} />
                            <ConfirmButton
                              variant="secondary"
                              confirm={describeQuestionRemovalConfirm(
                                q.label,
                                followUps,
                                "archive",
                              )}
                            >
                              Archive
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {archivedQuestions.length > 0 && (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-ink select-none hover:bg-sunken/50">
              Archived questions ({archivedQuestions.length})
            </summary>
            <CardBody className="border-t border-line pt-4">
              <ul className="divide-y divide-line">
                {archivedQuestions.map((q) => {
                  const answerCount = storedAnswerCounts.get(q.id) ?? 0;
                  const conditions = describeQuestionConditions(q, lookups);
                  return (
                    <li
                      key={q.id}
                      className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/rsvp/questions/${q.id}`}
                            className="font-medium text-ink-muted hover:text-ink hover:underline"
                          >
                            {q.label}
                          </Link>
                          <Badge tone="neutral">
                            {q.type === "choice" ? "Multiple choice" : "Short answer"}
                          </Badge>
                          <Badge tone="neutral">
                            {q.scope === "household" ? "Per household" : "Per guest"}
                          </Badge>
                          {answerCount > 0 && (
                            <span className="text-xs text-ink-faint">
                              {answerCount} {answerCount === 1 ? "answer" : "answers"} kept
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink-faint">
                          {conditions.join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <form action={restoreQuestion}>
                          <input type="hidden" name="id" value={q.id} />
                          <Button type="submit" variant="secondary" size="sm">
                            Restore
                          </Button>
                        </form>
                        {answerCount === 0 && (
                          <form action={deleteQuestion}>
                            <input type="hidden" name="id" value={q.id} />
                            <ConfirmButton
                              confirm={describeQuestionRemovalConfirm(
                                q.label,
                                [],
                                "delete",
                              )}
                            >
                              Delete
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </details>
        )}
      </div>
    </div>
  );
}
