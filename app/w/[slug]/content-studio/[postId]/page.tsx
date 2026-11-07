import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  cancelPostAction,
  decidePostAction,
  deletePostAction,
  publishNowAction,
  schedulePostAction,
  submitForApprovalAction,
} from "@/lib/actions/content";
import { formatDateTime, parseJson, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PostDetailPage({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const post = await db.post.findFirst({
    where: { id: postId, workspaceId: ctx.workspace.id, deletedAt: null },
    include: {
      creator: true,
      campaign: true,
      media: { include: { asset: true }, orderBy: { position: "asc" } },
      hashtags: { include: { hashtag: true } },
      targets: {
        include: {
          socialAccount: true,
          publishJobs: { include: { attemptsList: { orderBy: { attemptNumber: "asc" } } }, orderBy: { createdAt: "desc" } },
        },
      },
      approvals: { include: { reviewer: true }, orderBy: { requestedAt: "desc" } },
      tasks: true,
    },
  });
  if (!post) notFound();

  const canApprove = ctx.can(PERMISSIONS.POSTS_APPROVE);
  const canSchedule = ctx.can(PERMISSIONS.POSTS_SCHEDULE);
  const canEdit = ctx.can(PERMISSIONS.POSTS_CREATE) && !["published", "publishing", "queued"].includes(post.status);
  const firstAsset = post.media[0]?.asset;
  const pendingApproval = post.status === "pending_approval";
  const jobs = post.targets.flatMap((target) => target.publishJobs.map((job) => ({ ...job, target })));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Content Studio"
        title={post.title ?? "Untitled post"}
        description={`Created by ${post.creator.fullName} · ${formatDateTime(post.createdAt)}`}
        actions={
          <>
            <StatusBadge status={post.status} />
            {canEdit ? (
              <Button asChild variant="outline">
                <Link href={`/w/${slug}/content-studio/${post.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href={`/w/${slug}/content-studio`}>Back</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{post.creator.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{post.creator.fullName}</span>
                  <span className="text-muted-foreground">· {post.format.replaceAll("_", " ")}</span>
                </div>
                {firstAsset?.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firstAsset.publicUrl} alt={firstAsset.altText ?? ""} className="max-h-[420px] w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
                    No media attached
                  </div>
                )}
                <p className="whitespace-pre-wrap px-4 py-3 text-sm">{post.baseCaption}</p>
              </div>
              {post.media.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {post.media.map((media) => (
                    <span key={media.id} className="h-14 w-14 overflow-hidden rounded-md border border-border bg-muted">
                      {media.asset.publicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={media.asset.publicUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {post.hashtags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {post.hashtags.map((entry) => (
                    <Badge key={entry.hashtagId} variant="secondary">
                      #{entry.hashtag.tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account targets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {post.targets.map((target) => (
                <div key={target.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={target.socialAccount.platform === "instagram" ? "violet" : "info"}>
                        {target.socialAccount.platform}
                      </Badge>
                      <span className="text-sm font-medium">{target.socialAccount.accountName}</span>
                    </div>
                    <StatusBadge status={target.status} />
                  </div>
                  {target.caption && target.caption !== post.baseCaption ? (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                      {target.caption}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {target.scheduledAt ? <span>Scheduled {formatDateTime(target.scheduledAt)}</span> : null}
                    {target.publishedAt ? <span>Published {formatDateTime(target.publishedAt)}</span> : null}
                    {target.externalPermalink ? (
                      <a href={target.externalPermalink} className="inline-flex items-center gap-1 text-primary hover:underline">
                        View post <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  {target.lastError ? (
                    <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:text-red-300">
                      {target.lastError}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          {jobs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publish attempts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {job.target.socialAccount.accountName} · attempt {job.attempts}/{job.maxAttempts}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.attemptsList.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {job.attemptsList.map((attempt) => (
                          <li key={attempt.id}>
                            #{attempt.attemptNumber} {attempt.result}
                            {attempt.errorMessage ? ` — ${truncate(attempt.errorMessage, 120)}` : ""}
                            {attempt.responseCode ? ` (${attempt.responseCode})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={post.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Format</span>
                <span>{post.format.replaceAll("_", " ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Campaign</span>
                <span>{post.campaign?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span>{formatDateTime(post.submittedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tasks</span>
                <span>{post.tasks.length}</span>
              </div>
            </CardContent>
          </Card>

          {pendingApproval && canApprove ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={decidePostAction} className="space-y-3">
                  <input type="hidden" name="workspaceSlug" value={slug} />
                  <input type="hidden" name="postId" value={post.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor="comments">Comments (optional)</Label>
                    <Textarea id="comments" name="comments" placeholder="Leave context for the author…" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="decision" value="approved">
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button type="submit" name="decision" value="revision_requested" variant="outline">
                      Request changes
                    </Button>
                    <Button type="submit" name="decision" value="rejected" variant="ghost" className="text-red-600">
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canSchedule ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule & publish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["published", "cancelled"].includes(post.status) ? (
                  <p className="text-sm text-muted-foreground">This post is {post.status}.</p>
                ) : (
                  <>
                    <form action={schedulePostAction} className="space-y-2">
                      <input type="hidden" name="workspaceSlug" value={slug} />
                      <input type="hidden" name="postId" value={post.id} />
                      <Label htmlFor="scheduledAt">Schedule for</Label>
                      <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
                      <Button type="submit" variant="outline" className="w-full">
                        <CalendarClock className="h-4 w-4" /> Schedule
                      </Button>
                    </form>
                    <form action={publishNowAction}>
                      <input type="hidden" name="workspaceSlug" value={slug} />
                      <input type="hidden" name="postId" value={post.id} />
                      <Button type="submit" className="w-full">
                        <Send className="h-4 w-4" /> Publish now
                      </Button>
                    </form>
                    {post.status === "draft" || post.status === "revision_required" ? (
                      <form action={submitForApprovalAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="postId" value={post.id} />
                        <Button type="submit" variant="secondary" className="w-full">
                          Submit for approval
                        </Button>
                      </form>
                    ) : null}
                    <form action={cancelPostAction}>
                      <input type="hidden" name="workspaceSlug" value={slug} />
                      <input type="hidden" name="postId" value={post.id} />
                      <Button type="submit" variant="ghost" className="w-full text-amber-600">
                        Cancel post
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {post.approvals.length === 0 ? (
                <EmptyState title="No reviews yet" description="Approvals will show up here." className="border-0 py-6" />
              ) : (
                post.approvals.map((approval) => (
                  <div key={approval.id} className="rounded-md border border-border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{approval.reviewer.fullName}</span>
                      <Badge variant={approval.decision === "approved" ? "success" : approval.decision === "pending" ? "warning" : "danger"}>
                        {approval.decision.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requested {formatDateTime(approval.requestedAt)}
                      {approval.decidedAt ? ` · decided ${formatDateTime(approval.decidedAt)}` : ""}
                    </p>
                    {approval.comments ? <p className="mt-1 text-xs">{approval.comments}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {canEdit ? (
            <form action={deletePostAction}>
              <input type="hidden" name="workspaceSlug" value={slug} />
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" variant="ghost" className="w-full text-red-600">
                <Trash2 className="h-4 w-4" /> Delete post
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
