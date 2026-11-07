import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, ExternalLink, RotateCcw } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { decidePostAction } from "@/lib/actions/content";
import { formatDateTime, relativeTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

const postInclude = {
  creator: true,
  campaign: true,
  targets: { include: { socialAccount: true } },
  media: { include: { asset: true }, orderBy: { position: "asc" } },
} as const;

type ReviewablePost = Prisma.PostGetPayload<{ include: typeof postInclude }>;

function ReviewCard({
  slug,
  post,
  canDecide,
  note,
}: {
  slug: string;
  post: ReviewablePost;
  canDecide: boolean;
  note?: string;
}) {
  const asset = post.media[0]?.asset;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
          {asset?.publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No media</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/w/${slug}/content-studio/${post.id}`} className="text-sm font-semibold hover:underline">
              {post.title ?? "Untitled post"}
            </Link>
            <StatusBadge status={post.status} />
            {post.campaign ? <Badge variant="outline">{post.campaign.name}</Badge> : null}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{post.baseCaption}</p>
          {note ? <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">{note}</p> : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback>{post.creator.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {post.creator.fullName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> submitted {relativeTime(post.submittedAt ?? post.updatedAt)}
            </span>
            <span>{post.targets.map((target) => target.socialAccount.platform).join(", ")}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-44">
          {canDecide ? (
            <form action={decidePostAction} className="flex flex-col gap-2">
              <input type="hidden" name="workspaceSlug" value={slug} />
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" name="decision" value="approved" size="sm">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button type="submit" name="decision" value="revision_requested" size="sm" variant="outline">
                Request changes
              </Button>
              <Button type="submit" name="decision" value="rejected" size="sm" variant="ghost" className="text-red-600">
                Reject
              </Button>
            </form>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={`/w/${slug}/content-studio/${post.id}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Full preview
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ApprovalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Executives have no approve permission, but Board 1 gives them a limited
  // view of their own submissions, so the context is loaded without the
  // permission and the branches below narrow what is shown.
  const ctx = await getWorkspaceContext(slug);

  if (ctx.role === "executive") {
    const ownPosts = await db.post.findMany({
      where: { workspaceId: ctx.workspace.id, createdBy: ctx.user.id, deletedAt: null },
      include: postInclude,
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    const awaiting = ownPosts.filter((post) =>
      ["pending_approval", "revision_required"].includes(post.status),
    );

    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Review"
          title="My submissions"
          description="Track the approval status of posts you created. Decisions are made by Admins and Managers."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Awaiting decision</p>
              <p className="mt-1 text-2xl font-semibold">{awaiting.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="mt-1 text-2xl font-semibold">{ownPosts.filter((post) => post.status === "approved").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Changes requested</p>
              <p className="mt-1 text-2xl font-semibold">
                {ownPosts.filter((post) => post.status === "revision_required").length}
              </p>
            </CardContent>
          </Card>
        </div>

        {ownPosts.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No submissions yet"
            description="When you submit a post for approval it will show up here with its status."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your submissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ownPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/w/${slug}/content-studio/${post.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm transition hover:bg-muted"
                >
                  <div className="min-w-0">
                    <span className="block truncate font-medium">
                      {post.title ?? truncate(post.baseCaption, 60) ?? "Untitled post"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Updated {formatDateTime(post.updatedAt)}
                    </span>
                  </div>
                  <StatusBadge status={post.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!ctx.can(PERMISSIONS.POSTS_APPROVE)) {
    redirect("/403");
  }

  const [pending, revision, recent] = await Promise.all([
    db.post.findMany({
      where: { workspaceId: ctx.workspace.id, status: "pending_approval", deletedAt: null },
      include: postInclude,
      orderBy: { submittedAt: "asc" },
    }),
    db.post.findMany({
      where: { workspaceId: ctx.workspace.id, status: "revision_required", deletedAt: null },
      include: postInclude,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.postApproval.findMany({
      where: { workspaceId: ctx.workspace.id, decision: { not: "pending" } },
      include: { post: true, reviewer: true },
      orderBy: { decidedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Review"
        title="Approval Center"
        description="Approve, reject or request changes. Comments are sent to the author."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Awaiting review</p>
            <p className="mt-1 text-2xl font-semibold">{pending.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Oldest waiting</p>
            <p className="mt-1 text-2xl font-semibold">
              {pending[0] ? relativeTime(pending[0].submittedAt ?? pending[0].updatedAt) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Recent decisions</p>
            <p className="mt-1 text-2xl font-semibold">{recent.length}</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pending review</h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No posts waiting for review"
            description="Submitted posts will land here for a decision."
          />
        ) : (
          pending.map((post) => <ReviewCard key={post.id} slug={slug} post={post} canDecide />)
        )}
      </section>

      {revision.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Revision requested
          </h2>
          {revision.map((post) => (
            <ReviewCard
              key={post.id}
              slug={slug}
              post={post}
              canDecide
              note="Waiting on the author to resubmit with changes."
            />
          ))}
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviewed history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions yet.</p>
          ) : (
            recent.map((approval) => (
              <div
                key={approval.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/w/${slug}/content-studio/${approval.postId}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {approval.post.title ?? truncate(approval.post.baseCaption, 50) ?? "Untitled post"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {approval.reviewer.fullName} · {formatDateTime(approval.decidedAt)}
                  </p>
                </div>
                <Badge variant={approval.decision === "approved" ? "success" : "danger"}>
                  {approval.decision.replaceAll("_", " ")}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
