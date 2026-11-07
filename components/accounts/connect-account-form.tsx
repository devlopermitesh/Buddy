"use client";

import { useActionState } from "react";
import { connectAccountAction } from "@/lib/actions/accounts";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";

const initial: ActionState = {};

export function ConnectAccountForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(connectAccountAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="connect-platform">Platform</Label>
        <select id="connect-platform" name="platform" defaultValue="instagram" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook Page</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="connect-name">Account name</Label>
        <Input id="connect-name" name="accountName" placeholder="Demo Brand" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="connect-username">Username</Label>
        <Input id="connect-username" name="username" placeholder="demobrand" />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Connecting…" : "Connect (mock OAuth)"}
      </Button>
    </form>
  );
}
