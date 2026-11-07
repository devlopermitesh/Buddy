"use client";

import { useActionState } from "react";
import {
  updateNotificationPreferencesAction,
  updatePasswordAction,
  updateProfileAction,
  updateUserPreferencesAction,
  updateWorkspaceAction,
} from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";

const initial: ActionState = {};

export function ProfileForm({
  slug,
  fullName,
  timezone,
}: {
  slug: string;
  fullName: string;
  timezone: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Full name</Label>
        <Input id="profile-name" name="fullName" defaultValue={fullName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-timezone">Timezone</Label>
        <Input id="profile-timezone" name="timezone" defaultValue={timezone} placeholder="UTC" required />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function PasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input id="current-password" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" name="newPassword" type="password" minLength={10} required />
        <p className="text-xs text-muted-foreground">At least 10 characters with upper, lower and numeric characters.</p>
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

export function WorkspaceForm({
  slug,
  name,
  timezone,
  approvalRequired,
}: {
  slug: string;
  name: string;
  timezone: string;
  approvalRequired: boolean;
}) {
  const [state, action, pending] = useActionState(updateWorkspaceAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input id="workspace-name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workspace-timezone">Default timezone</Label>
        <Input id="workspace-timezone" name="timezone" defaultValue={timezone} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="approvalRequired" defaultChecked={approvalRequired} className="mt-0.5 h-4 w-4 rounded border-input" />
        <span>
          Require approval before executives can schedule or publish.
          <span className="block text-xs text-muted-foreground">Admins and managers can still auto-approve their own posts.</span>
        </span>
      </label>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save workspace"}
      </Button>
    </form>
  );
}

export function PreferencesForm({
  slug,
  timezone,
  theme,
  defaultLanding,
}: {
  slug: string;
  timezone: string;
  theme: string;
  defaultLanding: string;
}) {
  const [state, action, pending] = useActionState(updateUserPreferencesAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pref-theme">Theme</Label>
          <select id="pref-theme" name="theme" defaultValue={theme} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pref-landing">Default landing</Label>
          <select
            id="pref-landing"
            name="defaultLanding"
            defaultValue={defaultLanding}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="dashboard">Dashboard</option>
            <option value="content-studio">Content studio</option>
            <option value="calendar">Calendar</option>
            <option value="analytics">Analytics</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pref-timezone">Timezone</Label>
        <Input id="pref-timezone" name="timezone" defaultValue={timezone} />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}

const NOTIFICATION_OPTIONS = [
  { value: "inApp", label: "In-app notifications" },
  { value: "email", label: "Email notifications" },
  { value: "discord", label: "Discord notifications" },
  { value: "published", label: "Post published" },
  { value: "failures", label: "Publishing failures" },
  { value: "approvals", label: "Approval requests" },
  { value: "dailySummary", label: "Daily summary" },
];

export function NotificationPreferencesForm({ slug, preferences }: { slug: string; preferences: Record<string, unknown> }) {
  const [state, action, pending] = useActionState(updateNotificationPreferencesAction, initial);
  const notifications = (preferences.notifications as Record<string, boolean> | undefined) ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="grid gap-1.5 sm:grid-cols-2">
        {NOTIFICATION_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={option.value}
              className="h-4 w-4 rounded border-input"
              defaultChecked={notifications[option.value] ?? true}
            />
            {option.label}
          </label>
        ))}
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Saving…" : "Save notification preferences"}
      </Button>
    </form>
  );
}
