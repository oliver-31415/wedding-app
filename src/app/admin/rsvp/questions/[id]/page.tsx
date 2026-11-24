import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/rsvp/question-form";
import { BackLink, Badge, Button, Card, CardBody, CardHeader, ConfirmButton, Notice, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import {
  describeQuestionRemovalConfirm,
  formatFollowUpWarning,
} from "@/lib/rsvp-admin/conditions";
import {
  archiveQuestionAndRedirect,
  deleteQuestionAndRedirect,
  restoreQuestion,
  updateQuestion,
} from "../actions";

export default async function EditRsvpQuestionPage({
  params,
}: PageProps<"/admin/rsvp/questions/[id]">) {
  const { wedding } = await requireHost();
  const { id } = await params;

  const [allQuestions, events, weddingTags, questionAnswers] = await Promise.all([
    db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.weddingId, wedding.id))
      .orderBy(asc(schema.questions.position), asc(schema.questions.createdAt)),
    db
      .select({
        id: schema.events.id,
        name: schema.events.name,
        rsvpEnabled: schema.events.rsvpEnabled,
      })
      .from(schema.events)
      .where(eq(schema.events.weddingId, wedding.id))
      .orderBy(asc(schema.events.position)),
    db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.weddingId, wedding.id))
      .orderBy(asc(schema.tags.name)),
    db
      .select({ value: schema.answers.value })
      .from(schema.answers)
      .where(
        and(
          eq(schema.answers.weddingId, wedding.id),
          eq(schema.answers.questionId, id),
        ),
      ),
  ]);

  const question = allQuestions.find((q) => q.id === id);
  if (!question) notFound();

  const childQuestions = allQuestions.filter((q) => q.parentQuestionId === question.id);
  const activeFollowUpLabels = childQuestions
    .filter((q) => !q.archived)
    .map((q) => q.label);
  const answeredOptionIds = Array.from(new Set(questionAnswers.map((a) => a.value)));
  const referencedOptionIds = Array.from(
    new Set(
      childQuestions
        .map((c) => c.parentOptionId)
        .filter((optId): optId is string => Boolean(optId)),
    ),
  );
  const answerCount = questionAnswers.length;
  const followUpWarning = formatFollowUpWarning(activeFollowUpLabels);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span>Edit question</span>
            {question.archived && <Badge tone="warn">Archived</Badge>}
          </span>
        }
        back={
          <BackLink href="/admin/rsvp/questions">Questions</BackLink>
        }
      />

      {question.archived && (
        <Notice tone="warn" title="This question is archived">
          Guests aren&apos;t asked this question right now. Restore it below to include it on the RSVP form again.
        </Notice>
      )}

      <Card>
        <CardBody>
          <QuestionForm
            action={updateQuestion}
            initial={{
              id: question.id,
              label: question.label,
              type: question.type,
              options: question.options,
              required: question.required,
              scope: question.scope,
              eventId: question.eventId,
              parentQuestionId: question.parentQuestionId,
              parentOptionId: question.parentOptionId,
              audience: question.audience,
            }}
            allQuestions={allQuestions}
            events={events}
            tags={weddingTags}
            answeredOptionIds={answeredOptionIds}
            referencedOptionIds={referencedOptionIds}
            answerCount={answerCount}
            childCount={childQuestions.length}
            submitLabel="Save question"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            question.archived
              ? "Restore or remove"
              : answerCount > 0
                ? "Archive question"
                : "Delete question"
          }
          description={
            question.archived
              ? "Restore this question to show it on your RSVP form again."
              : answerCount > 0
                ? `This question has ${answerCount} ${answerCount === 1 ? "answer" : "answers"}, so it can't be deleted. Archiving hides it from the RSVP form while keeping existing answers.`
                : "No guests have answered this question yet, so you can delete it permanently."
          }
        />
        <CardBody className="space-y-4">
          {!question.archived && followUpWarning && (
            <Notice tone="warn">{followUpWarning}</Notice>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {question.archived ? (
              <>
                <form action={restoreQuestion}>
                  <input type="hidden" name="id" value={question.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Restore question
                  </Button>
                </form>
                {answerCount === 0 && (
                  <form action={deleteQuestionAndRedirect}>
                    <input type="hidden" name="id" value={question.id} />
                    <ConfirmButton
                      confirm={describeQuestionRemovalConfirm(
                        question.label,
                        [],
                        "delete",
                      )}
                    >
                      Delete question
                    </ConfirmButton>
                  </form>
                )}
              </>
            ) : answerCount === 0 ? (
              <form action={deleteQuestionAndRedirect}>
                <input type="hidden" name="id" value={question.id} />
                <ConfirmButton
                  confirm={describeQuestionRemovalConfirm(
                    question.label,
                    activeFollowUpLabels,
                    "delete",
                  )}
                >
                  Delete question
                </ConfirmButton>
              </form>
            ) : (
              <form action={archiveQuestionAndRedirect}>
                <input type="hidden" name="id" value={question.id} />
                <ConfirmButton
                  variant="secondary"
                  confirm={describeQuestionRemovalConfirm(
                    question.label,
                    activeFollowUpLabels,
                    "archive",
                  )}
                >
                  Archive question
                </ConfirmButton>
              </form>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
