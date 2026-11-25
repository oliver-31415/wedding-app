import { asc, eq } from "drizzle-orm";
import { QuestionForm } from "@/components/admin/rsvp/question-form";
import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { EVERYONE } from "@/lib/audience";
import { requireHost } from "@/lib/auth";
import { DEFAULT_DIETARY_LABEL } from "@/lib/rsvp/dietary";
import { createQuestion } from "../actions";

export default async function NewRsvpQuestionPage({ searchParams }: PageProps<"/admin/rsvp/questions/new">) {
  const { wedding } = await requireHost();
  const { parent: parentParam, type: typeParam } = await searchParams;

  const [allQuestions, events, weddingTags] = await Promise.all([
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
  ]);

  // "+ Follow-up" on the questions list: start as a follow-up to that question.
  const parent =
    typeof parentParam === "string"
      ? allQuestions.find((q) => q.id === parentParam && !q.archived && q.type === "choice")
      : undefined;

  // "Ask about dietary requirements" starts from the ready-made checklist.
  const dietary =
    !parent && typeParam === "dietary" && !allQuestions.some((q) => q.type === "dietary" && !q.archived);

  return (
    <div>
      <PageHeader
        title={parent ? "Add a follow-up" : dietary ? "Ask about dietary requirements" : "Add a question"}
        description={
          parent
            ? `Asked after “${parent.label}”, only when guests give the answer you choose below.`
            : "This question will appear on your RSVP form for matching guests."
        }
        back={
          <BackLink href="/admin/rsvp/questions">Questions</BackLink>
        }
      />

      <Card>
        <CardBody>
          <QuestionForm
            action={createQuestion}
            initial={{
              label: dietary ? DEFAULT_DIETARY_LABEL : "",
              // Follow-ups are usually "tell us more", so they start as typed answers.
              type: dietary ? "dietary" : parent ? "text" : "choice",
              options: [],
              // Everyone answering (even "none") is what makes the totals complete.
              required: dietary,
              scope: parent?.scope ?? "guest",
              eventId: null,
              parentQuestionId: parent?.id ?? null,
              parentOptionId: null,
              audience: EVERYONE,
            }}
            allQuestions={allQuestions}
            events={events}
            tags={weddingTags}
            answeredOptionIds={[]}
            referencedOptionIds={[]}
            answerCount={0}
            childCount={0}
            submitLabel="Add question"
          />
        </CardBody>
      </Card>
    </div>
  );
}
