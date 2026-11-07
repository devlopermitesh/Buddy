import Link from "next/link";
import { PenSquare, Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending_approval" },
  { label: "Approved", value: "approved" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Published", value: "published" },
  { label: "Failed", value: "failed" },
];

export default async function ContentStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { slug } = await params;
  const { status, q } = await searchParams;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);

  const where = {
    workspaceId: ctx.workspace.id,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { baseCaption: { contains: q } }] } : {}),
  };

  const [posts, counts] = await Promise.all([
    db.post.findMany({
      where,
      include: {
        creator: true,
        targets: { include: { socialAccount: true } },
        media: { include: { asset: true }, orderBy: { position: "asc" } },
        campaign: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.post.groupBy({ by: ["status"], where: { workspaceId: ctx.workspace.id, deletedAt: null }, _count: true }),
  ]);

  const countMap = new Map(counts.map((row) => [row.status, row._count]));
  const total = counts.reduce((sum, row) => sum + row._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Content"
        title="Content Studio"
        description="Draft, review and schedule posts for every connected account."
        actions={
          <Button asChild>
            <Link href={`/w/${slug}/content-studio/new`}>
              <Plus className="h-4 w-4" /> New post
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const active = (status ?? "") === filter.value;
            const count = filter.value ? countMap.get(filter.value) ?? 0 : total;
            const query = new URLSearchParams();
            if (filter.value) query.set("status", filter.value);
            if (q) query.set("q", q);
            return (
              <Link
                key={filter.value || "all"}
                href={`/w/${slug}/content-studio${query.toString() ? `?${query.toString()}` : ""}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {filter.label} <span className="opacity-70">{count}</span>
              </Link>
            );
          })}
        </div>
        <form action={`/w/${slug}/content-studio`} className="relative w-full max-w-xs">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Search posts…" className="pl-8" />
        </form>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={PenSquare}
          title="No posts found"
          description={q || status ? "Try a different filter or search term." : "Create your first post to get started."}
          action={
            <Button asChild>
              <Link href={`/w/${slug}/content-studio/new`}>
                <Plus className="h-4 w-4" /> New post
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
                <TableHead>Status</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const asset = post.media[0]?.asset;
                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Link href={`/w/${slug}/content-studio/${post.id}`} className="flex items-center gap-3">
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          {asset?.publicUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={asset.publicUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-muted-foreground">
                              <PenSquare className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[280px] truncate text-sm font-medium">
                            {post.title ?? truncate(post.baseCaption, 50) ?? "Untitled post"}
                          </span>
                          <span className="block text-xs text-muted-foreground">{post.format.replaceAll("_", " ")}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {post.targets.map((target) => (
                          <Badge key={target.id} variant={target.socialAccount.platform === "instagram" ? "violet" : "info"}>
                            {target.socialAccount.platform}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{post.campaign?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>{post.creator.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{post.creator.fullName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(post.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
