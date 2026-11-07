import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const ctx = await getWorkspaceContext(slug);
  const post = await db.post.findFirst({
    where: { id: postId, workspaceId: ctx.workspace.id, deletedAt: null },
    select: { createdBy: true },
  });
  if (!post) notFound();

  // Approvers can review any submission. Everyone else (executives) may only
  // open their own submissions, matching the Approval Center visibility rules.
  if (!ctx.can(PERMISSIONS.POSTS_APPROVE) && post.createdBy !== ctx.user.id) {
    redirect("/403");
  }

  redirect(`/w/${slug}/content-studio/${postId}`);
}
