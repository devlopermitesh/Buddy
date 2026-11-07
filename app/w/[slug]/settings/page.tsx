import Link from "next/link";
import { Bell, Bot, Building2, Link2, ScrollText, User } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { parseJson, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NotificationPreferencesForm,
  PasswordForm,
  PreferencesForm,
  ProfileForm,
  WorkspaceForm,
} from "@/components/settings/settings-forms";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  const memberCount = await db.workspaceMember.count({ where: { workspaceId: ctx.workspace.id, status: "active" } });
  const preferences = parseJson<Record<string, unknown>>(ctx.user.preferences, {});
  const workspaceSettings = parseJson<{ plan?: string }>(ctx.workspace.settings, {});
  const theme = typeof preferences.theme === "string" ? preferences.theme : "system";
  const defaultLanding = typeof preferences.defaultLanding === "string" ? preferences.defaultLanding : "dashboard";
  const canManageWorkspace = ctx.can(PERMISSIONS.WORKSPACE_SETTINGS);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Settings" title="Settings" description="Manage your profile, workspace and notification preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">{ctx.user.email}</p>
            <ProfileForm slug={slug} fullName={ctx.user.fullName} timezone={ctx.user.timezone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PreferencesForm slug={slug} timezone={ctx.user.timezone} theme={theme} defaultLanding={defaultLanding} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">/{ctx.workspace.slug}</Badge>
              <Badge variant="info">{titleCase(workspaceSettings.plan ?? "free")}</Badge>
              <span>{memberCount} active members</span>
              <span>Role: {titleCase(ctx.role)}</span>
            </div>
            {canManageWorkspace ? (
              <WorkspaceForm
                slug={slug}
                name={ctx.workspace.name}
                timezone={ctx.workspace.defaultTimezone}
                approvalRequired={ctx.workspace.approvalRequired}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Only admins can change workspace settings.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationPreferencesForm slug={slug} preferences={preferences} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm slug={slug} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">More settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              { href: `/w/${slug}/accounts`, label: "Social accounts", icon: Link2, permission: PERMISSIONS.ACCOUNTS_CONNECT },
              { href: `/w/${slug}/discord`, label: "Discord integration", icon: Bot, permission: PERMISSIONS.DISCORD_VIEW },
              { href: `/w/${slug}/notifications`, label: "Notifications inbox", icon: Bell },
              { href: `/w/${slug}/activity-logs`, label: "Activity logs", icon: ScrollText, permission: PERMISSIONS.AUDITLOGS_VIEW },
            ]
              .filter((item) => !item.permission || ctx.can(item.permission))
              .map((item) => (
                <Button key={item.href} asChild variant="outline" className="justify-start">
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4" /> {item.label}
                  </Link>
                </Button>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
