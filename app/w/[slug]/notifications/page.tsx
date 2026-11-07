import Link from "next/link";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/settings";
import { cn, parseJson, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationPreferencesForm } from "@/components/settings/settings-forms";

function entityHref(slug: string, entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "post":
      return `/w/${slug}/content-studio/${entityId}`;
    case "task":
      return `/w/${slug}/tasks`;
    case "report":
      return `/w/${slug}/reports/${entityId}`;
    case "social_account":
      return `/w/${slug}/accounts`;
    case "workspace_member":
    case "invitation":
      return `/w/${slug}/team`;
    case "discord_integration":
      return `/w/${slug}/discord`;
    case "automation_rule":
      return `/w/${slug}/automation`;
    case "ai_recommendation":
      return `/w/${slug}/ai-scheduling`;
    default:
      return null;
  }
}

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;
  const ctx = await getWorkspaceContext(slug);
  const unreadOnly = filter === "unread";
  const notifications = await db.notification.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      OR: [{ userId: ctx.user.id }, { userId: null }],
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const preferences = parseJson<Record<string, unknown>>(ctx.user.preferences, {});

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Approval requests, publishing results and task assignments."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/w/${slug}/notifications${unreadOnly ? "" : "?filter=unread"}`}>{unreadOnly ? "Show all" : "Show unread"}</Link>
            </Button>
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="workspaceSlug" value={slug} />
              <Button type="submit" size="sm">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={unreadOnly ? "No unread notifications" : "No notifications yet"}
              description="Activity in your workspace will show up here."
            />
          ) : (
            notifications.map((notification) => {
              const href = entityHref(slug, notification.entityType, notification.entityId);
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-3",
                    !notification.isRead ? "border-l-4 border-l-primary" : "opacity-80",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {notification.title}
                          </Link>
                        ) : (
                          notification.title
                        )}
                      </p>
                      {notification.body ? <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p> : null}
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{notification.type.replaceAll("_", " ")}</Badge>
                        {relativeTime(notification.createdAt)}
                        {notification.userId === null ? <span>· workspace</span> : null}
                      </div>
                    </div>
                    {!notification.isRead ? (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Mark read
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" /> Unread
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">Notifications waiting for you in this workspace.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NotificationPreferencesForm slug={slug} preferences={preferences} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
