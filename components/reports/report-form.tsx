"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateReportAction } from "@/lib/actions/reports";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";

const initial: ActionState = {};

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ReportForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(generateReportAction, initial);
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    if (state?.ok && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
      const timer = setTimeout(() => {
        refreshed.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="report-type">Report type</Label>
        <select id="report-type" name="type" defaultValue="weekly" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="weekly">Weekly summary</option>
          <option value="monthly">Monthly summary</option>
          <option value="campaign">Campaign report</option>
          <option value="custom">Custom period</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="report-start">Start</Label>
          <Input id="report-start" name="periodStart" type="date" defaultValue={dateValue(weekAgo)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-end">End</Label>
          <Input id="report-end" name="periodEnd" type="date" defaultValue={dateValue(today)} />
        </div>
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Generating…" : "Generate report"}
      </Button>
    </form>
  );
}
