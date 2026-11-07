import Link from "next/link";
import { CheckSquare, MessageSquare, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { addTaskCommentAction, deleteTaskAction } from "@/lib/actions/tasks";
import { formatDate, relativeTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CreateTaskForm, TaskStatusSelect } from "@/components/tasks/task-forms";

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "in_review", label: "In review" },
  { key: "done", label: "Done" },
];

const PRIORITY_VARIANT: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view: rawView } = await searchParams;
  const view = rawView === "list" || rawView === "my" ? rawView : "board";
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.TASKS_MANAGE);
  const [tasks, members, campaigns] = await Promise.all([
    db.task.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        assignee: true,
        campaign: true,
        comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    }),
    db.workspaceMember.findMany({ where: { workspaceId: ctx.workspace.id }, include: { user: true } }),
    db.campaign.findMany({ where: { workspaceId: ctx.workspace.id, status: { not: "archived" } }, orderBy: { name: "asc" } }),
  ]);

  const visibleTasks = view === "my" ? tasks.filter((task) => task.assignedTo === ctx.user.id) : tasks;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Tasks"
        description="Team to-dos linked to campaigns and posts. AI recommendations can create tasks too."
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1">
        {[
          { key: "board", label: "Board" },
          { key: "list", label: "List" },
          { key: "my", label: "My tasks" },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={`/w/${slug}/tasks?view=${tab.key}`}
            className={
              view === tab.key
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "list" ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {visibleTasks.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                visibleTasks.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.assignee?.fullName ?? "Unassigned"}
                        {task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ""}
                        {task.campaign ? ` · ${task.campaign.name}` : ""}
                      </p>
                    </div>
                    <Badge variant={PRIORITY_VARIANT[task.priority] ?? "neutral"}>{task.priority}</Badge>
                    <TaskStatusSelect slug={slug} taskId={task.id} status={task.status} />
                    {["admin", "manager"].includes(ctx.role) ? (
                      <form action={deleteTaskAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Delete task">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnTasks = visibleTasks.filter((task) => task.status === column.key);
            return (
              <div key={column.key} className="rounded-xl border border-border bg-muted/30 p-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <h3 className="text-sm font-semibold">{column.label}</h3>
                  <Badge variant="outline">{columnTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {columnTasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">Nothing here.</p>
                  ) : (
                    columnTasks.map((task) => (
                      <Card key={task.id} className="shadow-none">
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">{task.title}</p>
                            <Badge variant={PRIORITY_VARIANT[task.priority] ?? "neutral"}>{task.priority}</Badge>
                          </div>
                          {task.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {task.assignee ? (
                              <span className="flex items-center gap-1">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className="text-[9px]">{task.assignee.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                {task.assignee.fullName}
                              </span>
                            ) : (
                              <span>Unassigned</span>
                            )}
                            {task.dueAt ? <span>· due {formatDate(task.dueAt)}</span> : null}
                          </div>
                          {task.campaign ? (
                            <Link href={`/w/${slug}/campaigns/${task.campaignId}`} className="block text-xs text-primary hover:underline">
                              {task.campaign.name}
                            </Link>
                          ) : null}
                          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                            <TaskStatusSelect slug={slug} taskId={task.id} status={task.status} />
                            <details className="relative">
                              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground">
                                <MessageSquare className="h-3.5 w-3.5" /> {task.comments.length}
                              </summary>
                              <div className="mt-2 space-y-2 rounded-md border border-border bg-card p-2">
                                {task.comments.map((comment) => (
                                  <div key={comment.id} className="text-xs">
                                    <p className="font-medium">{comment.user.fullName}</p>
                                    <p className="text-muted-foreground">{comment.body}</p>
                                    <p className="text-[10px] text-muted-foreground">{relativeTime(comment.createdAt)}</p>
                                  </div>
                                ))}
                                <form action={addTaskCommentAction} className="flex gap-1">
                                  <input type="hidden" name="workspaceSlug" value={slug} />
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <input
                                    name="body"
                                    placeholder="Comment…"
                                    className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1.5 text-xs"
                                    required
                                  />
                                  <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs">
                                    Add
                                  </Button>
                                </form>
                              </div>
                            </details>
                            {["admin", "manager"].includes(ctx.role) ? (
                              <form action={deleteTaskAction}>
                                <input type="hidden" name="workspaceSlug" value={slug} />
                                <input type="hidden" name="taskId" value={task.id} />
                                <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label="Delete task">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4" /> New task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTaskForm
              slug={slug}
              members={members.map((member) => ({ id: member.userId, fullName: member.user.fullName }))}
              campaigns={campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }))}
            />
          </CardContent>
        </Card>
      </div>
      )}

      {tasks.some((task) => task.status === "cancelled") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cancelled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {tasks
              .filter((task) => task.status === "cancelled")
              .map((task) => (
                <p key={task.id} className="text-sm text-muted-foreground line-through">
                  {truncate(task.title, 80)}
                </p>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
