"use client";

import { useActionState } from "react";
import { createAutomationRuleAction, updateAutomationRuleAction } from "@/lib/actions/automation";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/forms/form-message";

const RULE_TYPES = [
  { value: "best_time", label: "Best time suggestions" },
  { value: "queue_optimization", label: "Queue optimization" },
  { value: "content_gap_detection", label: "Content gap detection" },
  { value: "failure_monitoring", label: "Failure monitoring" },
  { value: "performance_insights", label: "Performance insights" },
  { value: "daily_planning", label: "Daily planning" },
];

const initial: ActionState = {};

export function CreateAutomationRuleForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createAutomationRuleAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rule-name">Name</Label>
          <Input id="rule-name" name="name" placeholder="Weekday morning optimizer" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-type">Rule type</Label>
          <select
            id="rule-type"
            name="ruleType"
            defaultValue="best_time"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            {RULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rule-config">Configuration (JSON)</Label>
        <Textarea id="rule-config" name="configuration" defaultValue="{}" rows={3} className="font-mono text-xs" />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create rule"}
      </Button>
    </form>
  );
}

export function EditAutomationRuleForm({
  slug,
  rule,
}: {
  slug: string;
  rule: { id: string; name: string; configuration: string; enabled: boolean };
}) {
  const [state, action, pending] = useActionState(updateAutomationRuleAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="ruleId" value={rule.id} />
      <div className="space-y-1.5">
        <Label htmlFor={`name-${rule.id}`}>Name</Label>
        <Input id={`name-${rule.id}`} name="name" defaultValue={rule.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`config-${rule.id}`}>Configuration (JSON)</Label>
        <Textarea id={`config-${rule.id}`} name="configuration" defaultValue={rule.configuration} rows={3} className="font-mono text-xs" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={rule.enabled} className="h-4 w-4 rounded border-input" />
        Enabled
      </label>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save rule"}
      </Button>
    </form>
  );
}
