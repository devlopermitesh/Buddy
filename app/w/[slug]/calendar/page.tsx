import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCalendar, type CalendarEvent } from "@/components/calendar/content-calendar";

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  scheduled: { bg: "#4f46e5", border: "#4338ca" },
  queued: { bg: "#0284c7", border: "#0369a1" },
  publishing: { bg: "#7c3aed", border: "#6d28d9" },
  published: { bg: "#059669", border: "#047857" },
  failed: { bg: "#dc2626", border: "#b91c1c" },
  partially_published: { bg: "#9333ea", border: "#7e22ce" },
  cancelled: { bg: "#64748b", border: "#475569" },
};

export default async function CalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);

  const [targets, unscheduled] = await Promise.all([
    db.postTarget.findMany({
      where: { workspaceId: ctx.workspace.id, scheduledAt: { not: null } },
      include: { post: true, socialAccount: true },
      orderBy: { scheduledAt: "asc" },
    }),
    db.post.findMany({
      where: { workspaceId: ctx.workspace.id, deletedAt: null, status: { in: ["approved", "draft"] } },
      include: { targets: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const events: CalendarEvent[] = targets.map((target) => {
    const colors = STATUS_COLORS[target.status] ?? STATUS_COLORS.scheduled;
    return {
      id: target.id,
      title: `${target.socialAccount.platform === "instagram" ? "IG" : "FB"} · ${target.post.title ?? truncate(target.post.baseCaption, 40)}`,
      start: (target.scheduledAt ?? target.createdAt).toISOString(),
      backgroundColor: colors.bg,
      borderColor: colors.border,
      extendedProps: {
        postId: target.postId,
        platform: target.socialAccount.platform,
        status: target.status,
        account: target.socialAccount.accountName,
      },
    };
  });

  const needsScheduling = unscheduled.filter((post) => post.targets.every((target) => target.status === "draft"));

  const scheduledDays = new Set(
    targets
      .filter((target) => target.scheduledAt && !["cancelled", "failed"].includes(target.status))
      .map((target) => target.scheduledAt!.toISOString().slice(0, 10)),
  );
  const contentGaps: Date[] = [];
  for (let i = 1; i <= 14; i += 1) {
    const date = new Date(Date.now() + i * 86400000);
    if (!scheduledDays.has(date.toISOString().slice(0, 10))) contentGaps.push(date);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Calendar"
        description="Drag scheduled posts to reschedule. Click an event to open the post."
        actions={
          ctx.can(PERMISSIONS.POSTS_CREATE) ? (
            <Button asChild>
              <Link href={`/w/${slug}/content-studio/new`}>
                <Plus className="h-4 w-4" /> New post
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <span key={status} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 capitalize text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.bg }} />
            {status.replaceAll("_", " ")}
          </span>
        ))}
      </div>

      <ContentCalendar slug={slug} events={events} />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Content gaps</CardTitle>
          <span className="text-xs text-muted-foreground">{contentGaps.length} open days in the next 14</span>
        </CardHeader>
        <CardContent>
          {contentGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every day in the next two weeks has scheduled content.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contentGaps.map((date) => (
                <Link
                  key={date.toISOString()}
                  href={`/w/${slug}/content-studio/new?date=${date.toISOString().slice(0, 10)}`}
                  className="rounded-full border border-dashed border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
                >
                  {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date)}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Ready to schedule
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/w/${slug}/content-studio`}>All posts</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {needsScheduling.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything approved already has a schedule.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {needsScheduling.map((post) => (
                <Link
                  key={post.id}
                  href={`/w/${slug}/content-studio/${post.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 transition hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{post.title ?? "Untitled post"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {post.targets.map((target) => target.status).join(", ") || "No targets"} · updated {formatDateTime(post.updatedAt)}
                    </span>
                  </span>
                  <Badge variant="outline">{post.status.replaceAll("_", " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
