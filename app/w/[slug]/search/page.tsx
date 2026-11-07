import Link from "next/link";
import { CheckSquare, Image as ImageIcon, Megaphone, PenSquare, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { formatDateTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const ctx = await getWorkspaceContext(slug);
  const query = (q ?? "").trim();

  const [posts, tasks, campaigns, media] = query
    ? await Promise.all([
        db.post.findMany({
          where: {
            workspaceId: ctx.workspace.id,
            deletedAt: null,
            OR: [{ title: { contains: query } }, { baseCaption: { contains: query } }],
          },
          include: { creator: true },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
        db.task.findMany({
          where: {
            workspaceId: ctx.workspace.id,
            OR: [{ title: { contains: query } }, { description: { contains: query } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
        db.campaign.findMany({
          where: {
            workspaceId: ctx.workspace.id,
            OR: [{ name: { contains: query } }, { description: { contains: query } }, { goal: { contains: query } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
        db.mediaAsset.findMany({
          where: {
            workspaceId: ctx.workspace.id,
            deletedAt: null,
            OR: [{ fileName: { contains: query } }, { altText: { contains: query } }, { tags: { contains: query } }],
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ])
    : [[], [], [], []];

  const total = posts.length + tasks.length + campaigns.length + media.length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Search"
        title={query ? `Results for “${query}”` : "Search"}
        description="Find posts, tasks, campaigns and media across this workspace."
      />

      <form action={`/w/${slug}/search`} method="get" className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Search everything in this workspace…"
          className="h-10 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {!query ? (
        <EmptyState icon={Search} title="Start typing to search" description="Results from every part of the workspace will appear here." />
      ) : total === 0 ? (
        <EmptyState icon={Search} title="No matches" description={`Nothing in this workspace matches “${query}”.`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PenSquare className="h-4 w-4" /> Posts ({posts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {posts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching posts.</p>
              ) : (
                posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/w/${slug}/content-studio/${post.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 transition hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {post.title ?? truncate(post.baseCaption, 60) ?? "Untitled post"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {post.creator.fullName} · {formatDateTime(post.updatedAt)}
                      </span>
                    </span>
                    <StatusBadge status={post.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckSquare className="h-4 w-4" /> Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching tasks.</p>
              ) : (
                tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/w/${slug}/tasks`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 transition hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        Updated {formatDateTime(task.updatedAt)}
                      </span>
                    </span>
                    <StatusBadge status={task.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4" /> Campaigns ({campaigns.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching campaigns.</p>
              ) : (
                campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/w/${slug}/campaigns/${campaign.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 transition hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{campaign.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {campaign.description ?? "No description"}
                      </span>
                    </span>
                    <StatusBadge status={campaign.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" /> Media ({media.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {media.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching media.</p>
              ) : (
                media.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/w/${slug}/media${asset.folder ? `?folder=${encodeURIComponent(asset.folder)}` : ""}`}
                    className="flex items-center gap-3 rounded-md border border-border p-2.5 transition hover:bg-muted"
                  >
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      {asset.publicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{asset.fileName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {asset.altText ?? asset.folder ?? asset.type}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
