"use client";

import { useActionState, useRef } from "react";
import { createTaskAction, updateTaskStatusAction } from "@/lib/actions/tasks";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";

const initial: ActionState = {};

export function CreateTaskForm({
  slug,
  members,
  campaigns,
}: {
  slug: string;
  members: { id: string; fullName: string }[];
  campaigns: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createTaskAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" name="title" placeholder="Draft launch carousel" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-description">Description</Label>
        <Textarea id="task-description" name="description" rows={2} placeholder="Optional context" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="task-assignee">Assignee</Label>
          <select id="task-assignee" name="assignedTo" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-priority">Priority</Label>
          <select id="task-priority" name="priority" defaultValue="medium" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-due">Due</Label>
          <Input id="task-due" name="dueAt" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-campaign">Campaign</Label>
          <select id="task-campaign" name="campaignId" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">None</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create task"}
      </Button>
    </form>
  );
}

export function TaskStatusSelect({ slug, taskId, status }: { slug: string; taskId: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={updateTaskStatusAction} className="contents">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
        aria-label="Task status"
      >
        <option value="todo">To do</option>
        <option value="in_progress">In progress</option>
        <option value="in_review">In review</option>
        <option value="done">Done</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </form>
  );
}
