import Link from "next/link";
import { BarChart3, Eye, Heart, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cn, formatNumber, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PerformanceChart, type PerformancePoint } from "@/components/charts/performance-chart";

const RANGES = [7, 30, 60, 90];
const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalised = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalised} ${suffix}`;
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { slug } = await params;
  const { range } = await searchParams;
  const days = RANGES.includes(Number(range)) ? Number(range) : 30;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ANALYTICS_VIEW);
  const since = new Date(Date.now() - days * 86400000);

  const [snapshots, accountMetrics, accounts] = await Promise.all([
    db.analyticsDaily.findMany({
      where: { workspaceId: ctx.workspace.id, metricDate: { gte: since } },
      include: { postTarget: { include: { post: true, socialAccount: true } } },
    }),
    db.accountMetricsDaily.findMany({
      where: { workspaceId: ctx.workspace.id, metricDate: { gte: since } },
      include: { socialAccount: true },
      orderBy: { metricDate: "asc" },
    }),
    db.socialAccount.findMany({ where: { workspaceId: ctx.workspace.id } }),
  ]);

  const byDate = new Map<string, { reach: number; engagement: number; impressions: number }>();
  const byPost = new Map<string, { postId: string; title: string; platform: string; reach: number; engagement: number; impressions: number }>();
  const byPlatform = new Map<string, { reach: number; engagement: number; impressions: number }>();

  for (const snapshot of snapshots) {
    const key = snapshot.metricDate.toISOString().slice(0, 10);
    const engagement = snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves + snapshot.clicks;
    const day = byDate.get(key) ?? { reach: 0, engagement: 0, impressions: 0 };
    day.reach += snapshot.reach;
    day.engagement += engagement;
    day.impressions += snapshot.impressions;
    byDate.set(key, day);

    const platform = snapshot.postTarget.socialAccount.platform;
    const platformEntry = byPlatform.get(platform) ?? { reach: 0, engagement: 0, impressions: 0 };
    platformEntry.reach += snapshot.reach;
    platformEntry.engagement += engagement;
    platformEntry.impressions += snapshot.impressions;
    byPlatform.set(platform, platformEntry);

    const postEntry = byPost.get(snapshot.postTargetId) ?? {
      postId: snapshot.postTarget.postId,
      title: snapshot.postTarget.post.title ?? truncate(snapshot.postTarget.post.baseCaption, 50) ?? "Untitled",
      platform,
      reach: 0,
      engagement: 0,
      impressions: 0,
    };
    postEntry.reach += snapshot.reach;
    postEntry.engagement += engagement;
    postEntry.impressions += snapshot.impressions;
    byPost.set(snapshot.postTargetId, postEntry);
  }

  const chartData: PerformancePoint[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`)),
      reach: value.reach,
      engagement: value.engagement,
    }));

  const totals = [...byDate.values()].reduce(
    (acc, day) => ({
      reach: acc.reach + day.reach,
      engagement: acc.engagement + day.engagement,
      impressions: acc.impressions + day.impressions,
    }),
    { reach: 0, engagement: 0, impressions: 0 },
  );
  const engagementRate = totals.impressions > 0 ? (totals.engagement / totals.impressions) * 100 : 0;

  const latestFollowers = new Map<string, { followers: number; gained: number }>();
  for (const metric of accountMetrics) {
    latestFollowers.set(metric.socialAccountId, { followers: metric.followers, gained: metric.followersGained });
  }
  const totalFollowers = [...latestFollowers.values()].reduce((sum, value) => sum + value.followers, 0);
  const totalGained = accountMetrics.reduce((sum, metric) => sum + metric.followersGained - metric.followersLost, 0);

  const topPosts = [...byPost.values()].sort((a, b) => b.engagement - a.engagement).slice(0, 8);

  // Best-time insight: group published target performance by weekday + hour.
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const bySlot = new Map<string, { day: number; hour: number; engagement: number; impressions: number; count: number }>();
  for (const snapshot of snapshots) {
    const publishedAt = snapshot.postTarget.publishedAt;
    if (!publishedAt) continue;
    const day = publishedAt.getDay();
    const hour = publishedAt.getHours();
    const key = `${day}-${hour}`;
    const slot = bySlot.get(key) ?? { day, hour, engagement: 0, impressions: 0, count: 0 };
    slot.engagement += snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves + snapshot.clicks;
    slot.impressions += snapshot.impressions;
    slot.count += 1;
    bySlot.set(key, slot);
  }
  const bestSlots = [...bySlot.values()]
    .map((slot) => ({
      ...slot,
      rate: slot.impressions > 0 ? (slot.engagement / slot.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.engagement - a.engagement)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Mock metrics collected from connected accounts. Data refreshes when a post publishes."
        actions={
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {RANGES.map((option) => (
              <Link
                key={option}
                href={`/w/${slug}/analytics?range=${option}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  days === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {option}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reach" value={formatNumber(totals.reach)} icon={Eye} tone="info" hint={`Last ${days} days`} />
        <StatCard label="Impressions" value={formatNumber(totals.impressions)} icon={BarChart3} />
        <StatCard label="Engagements" value={formatNumber(totals.engagement)} icon={Heart} tone="success" hint={`${engagementRate.toFixed(1)}% rate`} />
        <StatCard
          label="Followers"
          value={formatNumber(totalFollowers)}
          icon={Users}
          tone="violet"
          hint={`${totalGained >= 0 ? "+" : ""}${formatNumber(totalGained)} net`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Reach & engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No analytics yet. Publish a post to start collecting metrics.</p>
          ) : (
            <PerformanceChart data={chartData} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top posts</CardTitle>
          </CardHeader>
          <CardContent>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No post metrics in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPosts.map((post) => (
                    <TableRow key={`${post.postId}-${post.platform}`}>
                      <TableCell>
                        <Link href={`/w/${slug}/content-studio/${post.postId}`} className="text-sm font-medium hover:underline">
                          {post.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={post.platform === "instagram" ? "violet" : "info"}>{PLATFORM_LABEL[post.platform] ?? post.platform}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(post.reach)}</TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(post.engagement)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {post.impressions > 0 ? `${((post.engagement / post.impressions) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Best-time insights</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/w/${slug}/ai-scheduling`}>Slots</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {bestSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Publish a few posts to see which days and times perform best.
                </p>
              ) : (
                bestSlots.map((slot, index) => (
                  <div key={`${slot.day}-${slot.hour}`} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {DAYS[slot.day]} · {formatHour(slot.hour)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(slot.engagement)} engagements · {slot.count} post{slot.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge variant={index === 0 ? "success" : "outline"}>{slot.rate.toFixed(1)}%</Badge>
                  </div>
                ))
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                Based on published posts in the selected range.{" "}
                <Link href={`/w/${slug}/ai-scheduling`} className="font-medium text-primary hover:underline">
                  See recommended slots
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By platform</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {accounts.map((account) => {
                const metrics = byPlatform.get(account.platform) ?? { reach: 0, engagement: 0, impressions: 0 };
                const follower = latestFollowers.get(account.id);
                return (
                  <div key={account.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{account.accountName}</p>
                      <Badge variant={account.platform === "instagram" ? "violet" : "info"}>{PLATFORM_LABEL[account.platform]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(follower?.followers ?? 0)} followers · {formatNumber(metrics.reach)} reach ·{" "}
                      {formatNumber(metrics.engagement)} engagements
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
