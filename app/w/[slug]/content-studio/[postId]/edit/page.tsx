import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { updatePostAction } from "@/lib/actions/content";
import { PageHeader } from "@/components/ui/page-header";
import { PostForm } from "@/components/content/post-form";

export default async function EditPostPage({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const [post, accounts, media, campaigns] = await Promise.all([
    db.post.findFirst({
      where: { id: postId, workspaceId: ctx.workspace.id, deletedAt: null },
      include: { targets: true, media: { orderBy: { position: "asc" } } },
    }),
    db.socialAccount.findMany({ where: { workspaceId: ctx.workspace.id, status: "active" }, orderBy: { accountName: "asc" } }),
    db.mediaAsset.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    db.campaign.findMany({ where: { workspaceId: ctx.workspace.id, status: { not: "archived" } }, orderBy: { name: "asc" } }),
  ]);
  if (!post) notFound();
  if (post.createdBy !== ctx.user.id && !["admin", "manager"].includes(ctx.role)) notFound();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Content Studio" title="Edit post" description="Changes create a fresh draft target set." />
      <PostForm
        slug={slug}
        action={updatePostAction}
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
        post={{
          id: post.id,
          title: post.title,
          baseCaption: post.baseCaption,
          format: post.format,
          campaignId: post.campaignId,
          targetAccountIds: post.targets.map((target) => target.socialAccountId),
          targetCaptions: Object.fromEntries(post.targets.map((target) => [target.socialAccountId, target.caption ?? ""])),
          mediaIds: post.media.map((entry) => entry.mediaAssetId),
        }}
      />
    </div>
  );
}
