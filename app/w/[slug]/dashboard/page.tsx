import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate, formatDateTime, parseJson, relativeTime, truncate } from "@/lib/utils";
import { PerformanceChart, type PerformancePoint } from "@/components/charts/performance-chart";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onboarded?: string }>;
}) {
  const { slug } = await params;
  const { onboarded } = await searchParams;
  const ctx = await getWorkspaceContext(slug);
  const workspaceId = ctx.workspace.id;
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const fourteenDaysAgo = new Date(now.getTime() - 13 * 86400000);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [
    scheduledCount,
    pendingApprovals,
    publishedCount,
    metrics,
    upcoming,
    approvals,
    tasks,
    recommendations,
    activity,
    accounts,
    failures,
    failedCount,
    discordIntegration,
  ] = await Promise.all([
    db.postTarget.count({ where: { workspaceId, status: { in: ["scheduled", "queued"] }, scheduledAt: { gte: now, lte: inSevenDays } } }),
    db.post.count({ where: { workspaceId, status: "pending_approval", deletedAt: null } }),
    db.postTarget.count({ where: { workspaceId, status: "published", publishedAt: { gte: thirtyDaysAgo } } }),
    db.analyticsDaily.findMany({ where: { workspaceId, metricDate: { gte: thirtyDaysAgo } } }),
    db.postTarget.findMany({
      where: { workspaceId, status: { in: ["scheduled", "queued"] }, scheduledAt: { gte: now, lte: inSevenDays } },
      include: { post: true, socialAccount: true },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    db.post.findMany({
      where: { workspaceId, status: "pending_approval", deletedAt: null },
      include: { creator: true, targets: { include: { socialAccount: true } } },
      orderBy: { submittedAt: "asc" },
      take: 5,
    }),
    db.task.findMany({
      where: {
        workspaceId,
        status: { in: ["todo", "in_progress", "in_review"] },
        dueAt: { lte: endOfToday },
      },
      include: { assignee: true, campaign: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.aiRecommendation.findMany({
      where: { workspaceId, status: "suggested" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.activityLog.findMany({
      where: { workspaceId },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.socialAccount.findMany({ where: { workspaceId } }),
    db.postTarget.findMany({
      where: { workspaceId, status: "failed" },
      include: { post: true, socialAccount: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    db.postTarget.count({ where: { workspaceId, status: "failed" } }),
    db.discordIntegration.findUnique({ where: { workspaceId }, select: { id: true } }),
  ]);

  const engagement30 = metrics.reduce((sum, row) => sum + row.likes + row.comments + row.shares + row.saves, 0);
  const followers = accounts.reduce((sum, account) => sum + (parseJson<{ followers?: number }>(account.metadata, {}).followers ?? 0), 0);
  const onboardingSettings = parseJson<{ onboardingSkippedSteps?: number[] }>(ctx.workspace.settings, {});
  const skippedOnboardingSteps = new Set(onboardingSettings.onboardingSkippedSteps ?? []);

  const daily = new Map<string, { reach: number; engagement: number }>();
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(fourteenDaysAgo.getTime() + i * 86400000);
    daily.set(day.toISOString().slice(0, 10), { reach: 0, engagement: 0 });
  }
  for (const row of metrics) {
    if (row.metricDate < fourteenDaysAgo) continue;
    const key = row.metricDate.toISOString().slice(0, 10);
    const point = daily.get(key);
    if (!point) continue;
    point.reach += row.reach;
    point.engagement += row.likes + row.comments + row.shares + row.saves;
  }
  const chartData: PerformancePoint[] = Array.from(daily.entries()).map(([date, values]) => ({
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)),
    ...values,
  }));

  const needsAttention = [
    ...failures.map((failure) => ({
      id: `failure-${failure.id}`,
      title: failure.post.title ?? "Failed post",
      detail: `${failure.socialAccount.accountName}: ${truncate(failure.lastError ?? "Publishing failed", 70)}`,
      href: `/w/${slug}/queue`,
      tone: "danger" as const,
      icon: AlertTriangle,
    })),
    ...accounts
      .filter((account) => account.status !== "active")
      .map((account) => ({
        id: `account-${account.id}`,
        title: `${account.accountName} needs reconnecting`,
        detail: "Queued posts will not publish until this account is active.",
        href: `/w/${slug}/accounts`,
        tone: "warning" as const,
        icon: Users,
      })),
  ].slice(0, 5);

  const firstName = ctx.user.fullName.split(" ")[0];

  return (
    <div className="space-y-6">
      {onboarded ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Onboarding complete. Welcome to {ctx.workspace.name}.
        </div>
      ) : null}

      {accounts.some((account) => account.status !== "active") ? (
        <Link
          href={`/w/${slug}/accounts`}
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          One or more connected accounts need to be reconnected before queued posts can publish. Reconnect now.
        </Link>
      ) : null}

      {ctx.role === "admin" && accounts.length === 0 ? (
        <Link
          href={`/w/${slug}/accounts`}
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-300"
        >
          <Users className="h-4 w-4 shrink-0" />
          {skippedOnboardingSteps.has(3)
            ? "Social account setup was skipped. Connect Instagram or Facebook when you're ready."
            : "Connect Instagram or Facebook so scheduled posts can publish. Connect accounts."}
        </Link>
      ) : null}

      {ctx.role === "admin" && !discordIntegration ? (
        <Link
          href={`/w/${slug}/discord`}
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-300"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          {skippedOnboardingSteps.has(4)
            ? "Discord setup was skipped. Connect your server when you're ready."
            : "Discord is not connected. Add the bot to your server to get approvals and publishing updates. Connect Discord."}
        </Link>
      ) : null}
      <PageHeader
        eyebrow={ctx.workspace.name}
        title={`Good to see you, ${firstName}`}
        description="Here's what needs your attention across the workspace today."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/w/${slug}/calendar`}>
                <CalendarDays className="h-4 w-4" /> Calendar
              </Link>
            </Button>
            {ctx.can(PERMISSIONS.POSTS_CREATE) ? (
              <Button asChild>
                <Link href={`/w/${slug}/content-studio/new`}>
                  <Plus className="h-4 w-4" /> New post
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Scheduled next 7 days"
          value={scheduledCount}
          icon={CalendarDays}
          href={`/w/${slug}/queue`}
          hint="Across connected accounts"
        />
        <StatCard
          label="Pending approvals"
          value={pendingApprovals}
          icon={CheckCircle2}
          tone="warning"
          href={`/w/${slug}/approvals`}
          hint="Waiting for a reviewer"
        />
        <StatCard
          label="Published (30 days)"
          value={publishedCount}
          icon={Send}
          tone="success"
          href={`/w/${slug}/queue?status=published`}
          hint="Successful targets"
        />
        <StatCard
          label="Failed posts"
          value={failedCount}
          icon={AlertTriangle}
          tone="danger"
          href={`/w/${slug}/queue?status=failed`}
          hint="Retry or troubleshoot"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Performance</CardTitle>
              <p className="text-xs text-muted-foreground">Reach and engagement, last 14 days</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/w/${slug}/analytics`}>
                Analytics <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <PerformanceChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
            <p className="text-xs text-muted-foreground">Failures and disconnected accounts</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsAttention.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All clear" description="No publishing failures or account issues." className="border-0 py-8" />
            ) : (
              needsAttention.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-2.5 rounded-md border border-border p-2.5 transition hover:bg-muted"
                >
                  <span
                    className={
                      item.tone === "danger"
                        ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600"
                        : "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"
                    }
                  >
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Account health</CardTitle>
              <p className="text-xs text-muted-foreground">
                {followers.toLocaleString()} followers · {engagement30.toLocaleString()} engagements
              </p>
            </div>
            {ctx.can(PERMISSIONS.ACCOUNTS_CONNECT) ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/w/${slug}/accounts`}>Manage</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No accounts connected"
                description="Connect Instagram or Facebook to start publishing."
                className="border-0 py-6"
              />
            ) : (
              accounts.slice(0, 5).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.accountName}</p>
                    <p className="text-xs capitalize text-muted-foreground">{account.platform}</p>
                  </div>
                  <Badge variant={account.status === "active" ? "success" : "warning"}>{account.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/w/${slug}/queue`}>Queue</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState icon={Clock} title="Nothing scheduled" description="Schedule a post to see it here." className="border-0 py-8" />
            ) : (
              upcoming.map((target) => (
                <div key={target.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{target.post.title ?? truncate(target.post.baseCaption, 50)}</p>
                    <p className="text-xs text-muted-foreground">
                      {target.socialAccount.accountName} · {formatDateTime(target.scheduledAt)}
                    </p>
                  </div>
                  <StatusBadge status={target.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Approvals</CardTitle>
            {ctx.can(PERMISSIONS.POSTS_APPROVE) ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/w/${slug}/approvals`}>Review</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No pending approvals" description="Submitted posts will appear here." className="border-0 py-8" />
            ) : (
              approvals.map((post) => (
                <Link key={post.id} href={`/w/${slug}/content-studio/${post.id}`} className="flex items-start gap-2.5 rounded-md border border-border p-2.5 transition hover:bg-muted">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{post.creator.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{post.title ?? "Untitled post"}</p>
                    <p className="text-xs text-muted-foreground">
                      {post.creator.fullName} · {post.targets.map((target) => target.socialAccount.platform).join(", ")}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Today&apos;s tasks</CardTitle>
            {ctx.can(PERMISSIONS.TASKS_MANAGE) ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/w/${slug}/tasks`}>All tasks</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="Nothing due today"
                description="You're clear for the day. New tasks will show up here."
                className="border-0 py-8"
              />
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.assignee?.fullName ?? "Unassigned"} · due {task.dueAt ? formatDate(task.dueAt) : "—"}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" /> AI suggestions
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/w/${slug}/ai-scheduling`}>Open</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.length === 0 ? (
              <EmptyState icon={Sparkles} title="No suggestions right now" description="Run an automation rule to generate recommendations." className="border-0 py-8" />
            ) : (
              recommendations.map((recommendation) => {
                const payload = parseJson<Record<string, unknown>>(recommendation.payload, {});
                return (
                  <div key={recommendation.id} className="rounded-md border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="violet">{recommendation.type.replaceAll("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{relativeTime(recommendation.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {String(payload.reasoning ?? payload.headline ?? payload.detail ?? "Review this suggestion.")}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <EmptyState icon={Clock} title="No activity yet" className="border-0 py-8" />
            ) : (
              activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.actor?.fullName ?? "System"}</span>{" "}
                      {entry.action.replaceAll(".", " ").replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">{relativeTime(entry.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
