import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createPostAction } from "@/lib/actions/content";
import { PageHeader } from "@/components/ui/page-header";
import { PostForm } from "@/components/content/post-form";

export default async function NewPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const { date } = await searchParams;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const [accounts, media, campaigns] = await Promise.all([
    db.socialAccount.findMany({ where: { workspaceId: ctx.workspace.id, status: "active" }, orderBy: { accountName: "asc" } }),
    db.mediaAsset.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    db.campaign.findMany({ where: { workspaceId: ctx.workspace.id, status: { not: "archived" } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Content Studio"
        title="New post"
        description="Write once, tailor captions per account, then draft, submit, schedule or publish."
      />
      <PostForm
        slug={slug}
        action={createPostAction}
        accounts={accounts.map((account) => ({
          id: account.id,
          accountName: account.accountName,
          platform: account.platform,
          username: account.username,
        }))}
        media={media.map((asset) => ({
          id: asset.id,
          fileName: asset.fileName,
          publicUrl: asset.publicUrl,
          type: asset.type,
          altText: asset.altText,
        }))}
        campaigns={campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }))}
        defaultScheduleAt={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T09:00` : undefined}
      />
    </div>
  );
}
