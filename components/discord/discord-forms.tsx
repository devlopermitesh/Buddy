"use client";

import { useActionState } from "react";
import {
  connectDiscordServerAction,
  linkDiscordUserAction,
  updateCommandPermissionsAction,
  updateDiscordSettingsAction,
} from "@/lib/actions/discord";
import type { ActionState } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/forms/form-message";

const initial: ActionState = {};

const COMMANDS = [
  { value: "dashboard", label: "/dashboard" },
  { value: "posts", label: "/posts" },
  { value: "tasks", label: "/tasks" },
  { value: "publish-status", label: "/publish-status" },
  { value: "approvals", label: "/approvals" },
  { value: "configure", label: "/configure" },
];

const NOTIFICATIONS = [
  { value: "published", label: "Post published" },
  { value: "failed", label: "Publishing failed" },
  { value: "approvalRequired", label: "Approval required" },
  { value: "upcomingPost", label: "Upcoming post reminder" },
  { value: "dailySummary", label: "Daily summary" },
  { value: "weeklyReport", label: "Weekly report" },
];

export function ConnectDiscordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(connectDiscordServerAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="discord-guild-name">Server name</Label>
        <Input id="discord-guild-name" name="guildName" placeholder="SocialFlow Team" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="discord-guild-id">Server (guild) ID</Label>
        <Input id="discord-guild-id" name="discordGuildId" placeholder="123456789012345678" required />
        <p className="text-xs text-muted-foreground">
          Right-click your server in Discord with developer mode on to copy the ID. This build simulates the bot install.
        </p>
        {state?.fieldErrors?.discordGuildId ? (
          <p className="text-xs text-red-600">{state.fieldErrors.discordGuildId}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="discord-connect-channel">Notifications channel ID (optional)</Label>
        <Input id="discord-connect-channel" name="notificationChannelId" placeholder="123456789012345678" />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect Discord server"}
      </Button>
    </form>
  );
}

export function DiscordSettingsForm({
  slug,
  integration,
  notifications,
}: {
  slug: string;
  integration: {
    notificationChannelId: string | null;
    approvalsChannelId: string | null;
    alertsChannelId: string | null;
    reportsChannelId: string | null;
  };
  notifications: Record<string, boolean>;
}) {
  const [state, action, pending] = useActionState(updateDiscordSettingsAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="discord-notifications">Notifications channel ID</Label>
          <Input id="discord-notifications" name="notificationChannelId" defaultValue={integration.notificationChannelId ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discord-approvals">Approvals channel ID</Label>
          <Input id="discord-approvals" name="approvalsChannelId" defaultValue={integration.approvalsChannelId ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discord-alerts">Alerts channel ID</Label>
          <Input id="discord-alerts" name="alertsChannelId" defaultValue={integration.alertsChannelId ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discord-reports">Reports channel ID</Label>
          <Input id="discord-reports" name="reportsChannelId" defaultValue={integration.reportsChannelId ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Notifications</Label>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {NOTIFICATIONS.map((notification) => (
            <label key={notification.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={notification.value}
                className="h-4 w-4 rounded border-input"
                defaultChecked={notifications[notification.value] ?? true}
              />
              {notification.label}
            </label>
          ))}
        </div>
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

export function CommandPermissionsForm({ slug, selected }: { slug: string; selected: string[] }) {
  const [state, action, pending] = useActionState(updateCommandPermissionsAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="grid gap-1.5 sm:grid-cols-2">
        {COMMANDS.map((command) => (
          <label key={command.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="commands"
              value={command.value}
              className="h-4 w-4 rounded border-input"
              defaultChecked={selected.includes(command.value)}
            />
            <code className="text-xs">{command.label}</code>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Admins get every enabled command, managers get all except <code>/configure</code>, executives get dashboard, posts, tasks and publish-status.
      </p>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save command permissions"}
      </Button>
    </form>
  );
}

export function LinkDiscordForm({
  slug,
  link,
}: {
  slug: string;
  link: { discordUserId: string; discordUsername: string | null } | null;
}) {
  const [state, action, pending] = useActionState(linkDiscordUserAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="discord-user-id">Discord user ID</Label>
        <Input id="discord-user-id" name="discordUserId" defaultValue={link?.discordUserId ?? ""} placeholder="123456789012345678" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="discord-username">Discord username</Label>
        <Input id="discord-username" name="discordUsername" defaultValue={link?.discordUsername ?? ""} placeholder="username" />
      </div>
      <FormMessage error={state?.error} message={state?.message} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : link ? "Update link" : "Link my Discord"}
      </Button>
    </form>
  );
}
