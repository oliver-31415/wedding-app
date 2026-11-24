import { asc, eq } from "drizzle-orm";
import { QuestionForm } from "@/components/admin/rsvp/question-form";
import { BackLink, Card, CardBody, PageHeader } from "@/components/ui";
import { db, schema } from "@/db";
import { EVERYONE } from "@/lib/audience";
import { requireHost } from "@/lib/auth";
import { createQuestion } from "../actions";

export default async function NewRsvpQuestionPage() {
  const { wedding } = await requireHost();

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

  return (
    <div>
      <PageHeader
        title="Add a question"
        description="This question will appear on your RSVP form for matching guests."
        back={
          <BackLink href="/admin/rsvp/questions">Questions</BackLink>
        }
      />

      <Card>
        <CardBody>
          <QuestionForm
            action={createQuestion}
            initial={{
              label: "",
              type: "choice",
              options: [],
              required: false,
              scope: "guest",
              eventId: null,
              parentQuestionId: null,
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
