import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { MediaManager } from "@/components/media/media-manager";
import { cn } from "@/lib/utils";

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; q?: string; folder?: string }>;
}) {
  const { slug } = await params;
  const { type, q, folder } = await searchParams;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEDIA_MANAGE);

  const assets = await db.mediaAsset.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(folder ? { folder } : {}),
      ...(q ? { OR: [{ fileName: { contains: q } }, { altText: { contains: q } }, { tags: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const folders = await db.mediaAsset.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null, folder: { not: null } },
    distinct: ["folder"],
    select: { folder: true },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Library"
        title="Media library"
        description="Reusable images and video for your posts. Assets are stored locally in this build."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "All", value: "" },
            { label: "Images", value: "image" },
            { label: "Video", value: "video" },
          ].map((filter) => {
            const query = new URLSearchParams();
            if (filter.value) query.set("type", filter.value);
            if (folder) query.set("folder", folder);
            if (q) query.set("q", q);
            return (
              <Link
                key={filter.value || "all"}
                href={`/w/${slug}/media${query.toString() ? `?${query.toString()}` : ""}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  (type ?? "") === filter.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
          {folders.map((entry) =>
            entry.folder ? (
              <Link
                key={entry.folder}
                href={`/w/${slug}/media?folder=${encodeURIComponent(entry.folder)}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  folder === entry.folder
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {entry.folder}
              </Link>
            ) : null,
          )}
        </div>
        <form action={`/w/${slug}/media`} className="relative w-full max-w-xs">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          {folder ? <input type="hidden" name="folder" value={folder} /> : null}
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Search assets…" className="pl-8" />
        </form>
      </div>

      <MediaManager
        slug={slug}
        assets={assets.map((asset) => ({
          id: asset.id,
          fileName: asset.fileName,
          publicUrl: asset.publicUrl,
          type: asset.type,
          sizeBytes: asset.sizeBytes,
          altText: asset.altText,
          folder: asset.folder,
          tags: asset.tags,
          createdAt: asset.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
