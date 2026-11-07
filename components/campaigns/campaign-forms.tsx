"use client";

import { useActionState } from "react";
import { createCampaignAction } from "@/lib/actions/tasks";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";

const initial: ActionState = {};

export function CreateCampaignForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createCampaignAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="campaign-name">Name</Label>
        <Input id="campaign-name" name="name" placeholder="Summer launch" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-description">Description</Label>
        <Textarea id="campaign-description" name="description" rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-status">Status</Label>
          <select id="campaign-status" name="status" defaultValue="planned" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-color">Color</Label>
          <Input id="campaign-color" name="color" type="color" defaultValue="#4f46e5" className="h-9 p-1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-start">Start</Label>
          <Input id="campaign-start" name="startDate" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign-end">End</Label>
          <Input id="campaign-end" name="endDate" type="date" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-goal">Goal</Label>
        <Input id="campaign-goal" name="goal" placeholder="Grow reach 20%" />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create campaign"}
      </Button>
    </form>
  );
}
