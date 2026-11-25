import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { addSuggestedTasksAction, deleteTaskAction, toggleTaskAction } from "@/app/admin/checklist/actions";
import { AddTaskForm, EditTaskForm } from "@/components/admin/checklist/task-forms";
import { dueText } from "@/components/admin/budget/parts";
import { Badge, Button, Card, CardBody, CardHeader, ConfirmButton, EmptyState, PageHeader, Progress, SubNav, TextBlock, cn } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateShort, todayIn } from "@/lib/dates";
import { groupTasks, TASK_GROUP_LABEL } from "@/lib/planning";
import { loadHosts } from "@/lib/planning-data";

export const metadata: Metadata = { title: "Checklist" };

export default async function ChecklistPage({ searchParams }: PageProps<"/admin/checklist">) {
  const { user, wedding } = await requireHost();
  const sp = await searchParams;
  const who = typeof sp.who === "string" ? sp.who : "all";
  const [allTasks, hosts] = await Promise.all([
    db.select().from(schema.tasks).where(eq(schema.tasks.weddingId, wedding.id)),
    loadHosts(wedding.id),
  ]);
  const today = todayIn(wedding.timeZone);
  const hostName = new Map(hosts.map((h) => [h.id, h.name]));
  const tasks = who === "mine" ? allTasks.filter((t) => t.assigneeId === user.id || t.assigneeId === null) : allTasks;
  const groups = groupTasks(tasks, today);
  const done = allTasks.filter((t) => t.doneAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklist"
        description="Everything to do before the day, with due dates and who’s on it — so you both know what’s next."
        actions={
          <form action={addSuggestedTasksAction}>
            <Button type="submit" size="sm" variant="secondary">
              Add suggested tasks
            </Button>
          </form>
        }
      />

      {allTasks.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink">{done}</span> of {allTasks.length} tasks done
            </p>
            <Progress value={done} max={allTasks.length} tone="good" label="Tasks done" />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <AddTaskForm hosts={hosts} />
        </CardBody>
      </Card>

      {allTasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body={
            wedding.date
              ? "Add your own, or start with our suggested checklist — due dates are worked back from your wedding date, including the Notice of Intended Marriage."
              : "Add your own, or start with our suggested checklist. Set your wedding date in Settings first and we’ll give each task a due date."
          }
          action={
            <form action={addSuggestedTasksAction}>
              <Button type="submit" variant="primary">
                Add suggested tasks
              </Button>
            </form>
          }
        />
      ) : (
        <>
          {hosts.length > 1 && (
            <SubNav
              label="Whose tasks"
              current={who === "mine" ? "/admin/checklist?who=mine" : "/admin/checklist"}
              items={[
                { href: "/admin/checklist", label: "Everyone’s" },
                { href: "/admin/checklist?who=mine", label: "Mine" },
              ]}
            />
          )}
          {groups.map((g) => (
            <Card key={g.key}>
              <CardHeader title={`${TASK_GROUP_LABEL[g.key]} (${g.tasks.length})`} />
              <ul className="divide-y divide-line">
                {g.tasks.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <form action={toggleTaskAction} className="pt-0.5">
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          aria-label={t.doneAt ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                          className={cn(
                            "flex size-5 items-center justify-center rounded border text-xs",
                            t.doneAt ? "border-good bg-good text-white" : "border-control bg-surface hover:border-brand",
                          )}
                        >
                          {t.doneAt ? "✓" : ""}
                        </button>
                      </form>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("text-sm font-medium", t.doneAt ? "text-ink-muted line-through" : "text-ink")}>{t.title}</span>
                          {t.assigneeId && hostName.get(t.assigneeId) && <Badge tone="brand">{hostName.get(t.assigneeId)}</Badge>}
                          {g.key === "overdue" && <Badge tone="bad">Overdue</Badge>}
                        </div>
                        {t.dueDate && !t.doneAt && (
                          <p className="text-sm text-ink-muted">
                            Due {formatDateShort(t.dueDate)} · {dueText(t.dueDate, today)}
                          </p>
                        )}
                        {t.notes && (
                          <div className="text-sm text-ink-muted">
                            <TextBlock text={t.notes} />
                          </div>
                        )}
                        <details>
                          <summary className="cursor-pointer text-sm text-ink-muted hover:text-ink">Edit</summary>
                          <div className="mt-3 space-y-3">
                            <EditTaskForm task={t} hosts={hosts} />
                            <form action={deleteTaskAction}>
                              <input type="hidden" name="id" value={t.id} />
                              <ConfirmButton confirm={`Delete “${t.title}”?`}>Delete task</ConfirmButton>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
