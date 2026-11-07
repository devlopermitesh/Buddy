"use client";

import { useActionState, useRef } from "react";
import { inviteMemberAction, changeMemberRoleAction, updateMemberOverridesAction } from "@/lib/actions/team";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";
import type { Role } from "@/lib/permissions";

const initial: ActionState = {};

export function InviteMemberForm({ slug, inviterRole }: { slug: string; inviterRole: Role }) {
  const [state, action, pending] = useActionState(inviteMemberAction, initial);
  const roleOptions =
    inviterRole === "admin" ? ["admin", "manager", "executive"] : inviterRole === "manager" ? ["manager", "executive"] : [];

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" placeholder="teammate@company.com" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select id="invite-role" name="role" defaultValue="executive" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role[0].toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      {state?.ok && typeof state.devLink === "string" ? (
        <p className="break-all rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          Dev invite link: {state.devLink}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || roleOptions.length === 0} className="w-full">
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}

export function MemberRoleForm({
  slug,
  memberId,
  role,
  disabled,
}: {
  slug: string;
  memberId: string;
  role: string;
  disabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  if (disabled) return <span className="text-xs text-muted-foreground">Owner</span>;
  return (
    <form ref={formRef} action={changeMemberRoleAction} className="contents">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="memberId" value={memberId} />
      <select
        name="role"
        defaultValue={role}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Member role"
      >
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
        <option value="executive">Executive</option>
      </select>
    </form>
  );
}

export function OverrideSelect({
  slug,
  memberId,
  permission,
  value,
}: {
  slug: string;
  memberId: string;
  permission: string;
  value: "inherit" | "allow" | "deny";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={updateMemberOverridesAction} className="contents">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="permission" value={permission} />
      <select
        name="value"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-7 rounded border border-input bg-background px-1 text-[11px]"
        aria-label={`Override ${permission}`}
      >
        <option value="inherit">Inherit</option>
        <option value="allow">Allow</option>
        <option value="deny">Deny</option>
      </select>
    </form>
  );
}
