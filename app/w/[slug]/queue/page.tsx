import Link from "next/link";
import { AlertTriangle, Clock, ListOrdered, RefreshCw, Send } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelPostAction, retryPublishAction } from "@/lib/actions/content";
import { formatDateTime, relativeTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function QueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status } = await searchParams;
  const activeFilter = ["scheduled", "processing", "published", "failed"].includes(status ?? "")
    ? (status as "scheduled" | "processing" | "published" | "failed")
    : "all";
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_SCHEDULE);
  const jobs = await db.publishJob.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      postTarget: { include: { post: true, socialAccount: true } },
      attemptsList: { orderBy: { attemptNumber: "desc" }, take: 1 },
    },
    orderBy: [{ status: "asc" }, { runAt: "asc" }],
    take: 200,
  });

  const waiting = jobs.filter((job) => job.status === "waiting").length;
  const retrying = jobs.filter((job) => job.status === "retrying").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const active = jobs.filter((job) => ["waiting", "retrying", "running"].includes(job.status));
  const attention = jobs.filter((job) => job.status === "failed");

  const matchesFilter = (job: (typeof jobs)[number]) => {
    switch (activeFilter) {
      case "scheduled":
        return ["waiting", "queued"].includes(job.status) && ["scheduled", "queued", "approved"].includes(job.postTarget.status);
      case "processing":
        return ["running", "retrying"].includes(job.status);
      case "published":
        return job.postTarget.status === "published";
      case "failed":
        return job.status === "failed" || job.postTarget.status === "failed";
      default:
        return true;
    }
  };
  const filteredJobs = jobs.filter(matchesFilter);

  const tabs = [
    { key: "all", label: "All", count: jobs.length },
    { key: "scheduled", label: "Scheduled", count: jobs.filter((job) => ["waiting", "queued"].includes(job.status)).length },
    { key: "processing", label: "Processing", count: jobs.filter((job) => ["running", "retrying"].includes(job.status)).length },
    { key: "published", label: "Published", count: jobs.filter((job) => job.postTarget.status === "published").length },
    { key: "failed", label: "Failed", count: jobs.filter((job) => job.status === "failed" || job.postTarget.status === "failed").length },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Publishing"
        title="Publishing Queue"
        description="Every publish attempt, in order. Failed jobs can be retried after you fix the cause."
        actions={
          <Button asChild variant="outline">
            <Link href={`/w/${slug}/calendar`}>Open calendar</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/w/${slug}/queue${tab.key === "all" ? "" : `?status=${tab.key}`}`}
            className={
              activeFilter === tab.key
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            }
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Waiting" value={waiting} icon={Clock} tone="info" />
        <StatCard label="Retrying" value={retrying} icon={RefreshCw} tone="warning" />
        <StatCard label="Failed" value={failed} icon={AlertTriangle} tone="danger" />
        <StatCard label="Total jobs" value={jobs.length} icon={ListOrdered} />
      </div>

      {attention.length > 0 && ["all", "failed"].includes(activeFilter) ? (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attention.map((job) => (
              <div key={job.id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.postTarget.post.title ?? "Untitled post"}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.postTarget.socialAccount.accountName} · attempt {job.attempts}/{job.maxAttempts} ·{" "}
                    {truncate(job.attemptsList[0]?.errorMessage ?? job.postTarget.lastError ?? "Unknown error", 90)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={retryPublishAction}>
                    <input type="hidden" name="workspaceSlug" value={slug} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <Button type="submit" size="sm">
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  </form>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/w/${slug}/content-studio/${job.postTarget.postId}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title={activeFilter === "all" ? "The queue is empty" : `No ${activeFilter} posts`}
          description={
            activeFilter === "all"
              ? "Schedule a post and its publish jobs will appear here."
              : "Nothing matches this filter yet."
          }
          action={
            <Button asChild>
              <Link href={`/w/${slug}/content-studio/new`}>
                <Send className="h-4 w-4" /> Create a post
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Run at</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link href={`/w/${slug}/content-studio/${job.postTarget.postId}`} className="block max-w-[260px] truncate text-sm font-medium">
                      {job.postTarget.post.title ?? truncate(job.postTarget.post.baseCaption, 50) ?? "Untitled"}
                    </Link>
                    <span className="text-xs text-muted-foreground">{relativeTime(job.runAt)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.postTarget.socialAccount.platform === "instagram" ? "violet" : "info"}>
                      {job.postTarget.socialAccount.accountName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(job.runAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.postTarget.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {job.attempts}/{job.maxAttempts}
                    {job.nextRetryAt ? <span className="block">retry {relativeTime(job.nextRetryAt)}</span> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {job.status === "failed" ? (
                        <form action={retryPublishAction}>
                          <input type="hidden" name="workspaceSlug" value={slug} />
                          <input type="hidden" name="jobId" value={job.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Retry
                          </Button>
                        </form>
                      ) : null}
                      {!["published", "cancelled"].includes(job.postTarget.status) ? (
                        <form action={cancelPostAction}>
                          <input type="hidden" name="workspaceSlug" value={slug} />
                          <input type="hidden" name="postId" value={job.postTarget.postId} />
                          <Button type="submit" variant="ghost" size="sm" className="text-amber-600">
                            Cancel
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
