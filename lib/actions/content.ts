"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { validateForPlatform, derivePostStatus } from "@/lib/platform-rules";
import { publishPostTargetNow, retryPublishJob, schedulePostTarget } from "@/lib/publishing";
import { createNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./types";

function parseMediaIds(formData: FormData) {
  return formData
    .getAll("mediaIds")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function hashtagsFromCaption(caption: string) {
  return Array.from(new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.slice(1).toLowerCase())));
}

async function syncHashtags(workspaceId: string, postId: string, captions: string[]) {
  const tags = Array.from(new Set(captions.flatMap(hashtagsFromCaption)));
  await db.postHashtag.deleteMany({ where: { postId } });
  for (const tag of tags) {
    const hashtag = await db.hashtag.upsert({
      where: { workspaceId_tag: { workspaceId, tag } },
      create: { workspaceId, tag, useCount: 1 },
      update: { useCount: { increment: 1 } },
    });
    await db.postHashtag.create({ data: { postId, hashtagId: hashtag.id } }).catch(() => undefined);
  }
}

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const title = String(formData.get("title") ?? "").trim();
  const baseCaption = String(formData.get("caption") ?? "").trim();
  const format = String(formData.get("format") ?? "feed_post");
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const intent = String(formData.get("intent") ?? "draft");
  const scheduleAt = String(formData.get("scheduleAt") ?? "");
  const mediaIds = parseMediaIds(formData);
  const accountIds = formData.getAll("accountIds").map(String).filter(Boolean);

  if (!title) return { error: "Add a title so the team can find this post.", fieldErrors: { title: "Title is required." } };
  if (!baseCaption) return { error: "Add a caption.", fieldErrors: { caption: "Caption is required." } };
  if (accountIds.length === 0) return { error: "Select at least one social account." };

  const accounts = await db.socialAccount.findMany({
    where: { id: { in: accountIds }, workspaceId: ctx.workspace.id, status: "active" },
  });
  if (accounts.length !== accountIds.length) return { error: "One or more selected accounts are unavailable." };

  for (const account of accounts) {
    const caption = String(formData.get(`caption_${account.id}`) ?? baseCaption);
    const errors = validateForPlatform({
      platform: account.platform,
      caption,
      mediaCount: mediaIds.length,
      format,
    });
    if (errors.length > 0) return { error: `${account.accountName}: ${errors[0]}` };
  }

  const needsApproval =
    intent === "approval" ||
    (ctx.workspace.approvalRequired && ctx.role === "executive" && intent !== "draft");
  const isAutoApproved =
    ["admin", "manager"].includes(ctx.role) && intent !== "draft" && intent !== "approval";

  const status = intent === "draft" ? "draft" : needsApproval ? "pending_approval" : isAutoApproved ? "approved" : "draft";

  const post = await db.post.create({
    data: {
      workspaceId: ctx.workspace.id,
      campaignId,
      title,
      baseCaption,
      format,
      status,
      createdBy: ctx.user.id,
      submittedAt: needsApproval ? new Date() : null,
    },
  });

  for (const [index, mediaId] of mediaIds.entries()) {
    await db.postMedia.create({ data: { postId: post.id, mediaAssetId: mediaId, position: index } });
  }

  const targets = [];
  for (const account of accounts) {
    const caption = String(formData.get(`caption_${account.id}`) ?? baseCaption).trim() || baseCaption;
    const target = await db.postTarget.create({
      data: {
        workspaceId: ctx.workspace.id,
        postId: post.id,
        socialAccountId: account.id,
        caption,
        status: "draft",
      },
    });
    targets.push(target);
  }

  await syncHashtags(ctx.workspace.id, post.id, [baseCaption, ...targets.map((t) => t.caption ?? "")]);

  if (needsApproval) {
    const reviewer = await db.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspace.id, role: { in: ["admin", "manager"] }, userId: { not: ctx.user.id } },
      orderBy: { role: "desc" },
    });
    await db.postApproval.create({
      data: {
        workspaceId: ctx.workspace.id,
        postId: post.id,
        reviewerId: reviewer?.userId ?? ctx.user.id,
        decision: "pending",
      },
    });
    await createNotification({
      workspaceId: ctx.workspace.id,
      type: "approval_required",
      title: `Approval required: ${title}`,
      body: `${ctx.user.fullName} submitted a post for review.`,
      entityType: "post",
      entityId: post.id,
    });
  }

  if (intent === "schedule" && scheduleAt) {
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime())) return { error: "Choose a valid schedule date and time." };
    if (needsApproval) {
      redirect(`/w/${slug}/content-studio/${post.id}?submitted=1`);
    }
    for (const target of targets) await schedulePostTarget(target.id, when);
    await db.post.update({ where: { id: post.id }, data: { status: "scheduled" } });
  }

  if (intent === "publish") {
    if (needsApproval) redirect(`/w/${slug}/content-studio/${post.id}?submitted=1`);
    for (const target of targets) await publishPostTargetNow(target.id);
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: `post.${intent === "draft" ? "created" : intent === "schedule" ? "scheduled" : intent === "publish" ? "published" : "submitted"}`,
    entityType: "post",
    entityId: post.id,
    metadata: { title, targets: accounts.map((a) => a.platform) },
  });
  revalidatePath(`/w/${slug}/content-studio`);
  revalidatePath(`/w/${slug}/queue`);
  revalidatePath(`/w/${slug}/calendar`);
  revalidatePath(`/w/${slug}/approvals`);
  redirect(`/w/${slug}/content-studio/${post.id}${needsApproval ? "?submitted=1" : "?created=1"}`);
}

export async function updatePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const postId = String(formData.get("postId") ?? "");
  const post = await db.post.findFirst({
    where: { id: postId, workspaceId: ctx.workspace.id, deletedAt: null },
    include: { targets: true },
  });
  if (!post) return { error: "Post not found." };
  if (["published", "publishing", "queued"].includes(post.status)) {
    return { error: "Published or in-flight posts cannot be edited." };
  }
  if (post.createdBy !== ctx.user.id && !["admin", "manager"].includes(ctx.role)) {
    return { error: "You can only edit your own posts." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const baseCaption = String(formData.get("caption") ?? "").trim();
  const format = String(formData.get("format") ?? post.format);
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const intent = String(formData.get("intent") ?? "save");
  const scheduleAt = String(formData.get("scheduleAt") ?? "");
  const mediaIds = parseMediaIds(formData);
  const accountIds = formData.getAll("accountIds").map(String).filter(Boolean);

  if (!title || !baseCaption) return { error: "Title and caption are required." };

  const accounts = await db.socialAccount.findMany({
    where: { id: { in: accountIds }, workspaceId: ctx.workspace.id, status: "active" },
  });
  if (accounts.length === 0) return { error: "Select at least one social account." };

  for (const account of accounts) {
    const caption = String(formData.get(`caption_${account.id}`) ?? baseCaption);
    const errors = validateForPlatform({ platform: account.platform, caption, mediaCount: mediaIds.length, format });
    if (errors.length > 0) return { error: `${account.accountName}: ${errors[0]}` };
  }

  const nextStatus =
    intent === "approval"
      ? "pending_approval"
      : intent === "schedule"
        ? ctx.workspace.approvalRequired && ctx.role === "executive"
          ? "pending_approval"
          : "scheduled"
        : intent === "publish"
          ? ctx.workspace.approvalRequired && ctx.role === "executive"
            ? "pending_approval"
            : "approved"
          : post.status === "revision_required"
            ? "draft"
            : post.status;

  await db.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: post.id },
      data: { title, baseCaption, format, campaignId, status: nextStatus, submittedAt: nextStatus === "pending_approval" ? new Date() : post.submittedAt },
    });
    await tx.postMedia.deleteMany({ where: { postId: post.id } });
    for (const [index, mediaId] of mediaIds.entries()) {
      await tx.postMedia.create({ data: { postId: post.id, mediaAssetId: mediaId, position: index } });
    }
    await tx.postTarget.deleteMany({ where: { postId: post.id, status: { in: ["draft", "scheduled", "failed"] } } });
    for (const account of accounts) {
      const caption = String(formData.get(`caption_${account.id}`) ?? baseCaption).trim() || baseCaption;
      await tx.postTarget.create({
        data: {
          workspaceId: ctx.workspace.id,
          postId: post.id,
          socialAccountId: account.id,
          caption,
          status: nextStatus === "scheduled" ? "scheduled" : "draft",
          scheduledAt: nextStatus === "scheduled" && scheduleAt ? new Date(scheduleAt) : null,
        },
      });
    }
  });

  await syncHashtags(ctx.workspace.id, post.id, [baseCaption]);

  const targets = await db.postTarget.findMany({ where: { postId: post.id } });
  if (intent === "schedule" && scheduleAt) {
    if (ctx.workspace.approvalRequired && ctx.role === "executive") {
      return { ok: true, message: "Submitted for approval. You can schedule once approved." };
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime())) return { error: "Choose a valid schedule date and time." };
    for (const target of targets) await schedulePostTarget(target.id, when);
    await db.post.update({ where: { id: post.id }, data: { status: "scheduled" } });
  }
  if (intent === "publish") {
    if (ctx.workspace.approvalRequired && ctx.role === "executive") {
      return { ok: true, message: "Submitted for approval. You can publish once approved." };
    }
    for (const target of targets) await publishPostTargetNow(target.id);
  }
  if (intent === "approval") {
    const reviewer = await db.workspaceMember.findFirst({
      where: { workspaceId: ctx.workspace.id, role: { in: ["admin", "manager"] }, userId: { not: ctx.user.id } },
    });
    await db.postApproval.create({
      data: { workspaceId: ctx.workspace.id, postId: post.id, reviewerId: reviewer?.userId ?? ctx.user.id },
    });
    await createNotification({
      workspaceId: ctx.workspace.id,
      type: "approval_required",
      title: `Approval required: ${title}`,
      body: `${ctx.user.fullName} submitted a post for review.`,
      entityType: "post",
      entityId: post.id,
    });
  }

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: `post.updated`,
    entityType: "post",
    entityId: post.id,
    metadata: { intent },
  });
  revalidatePath(`/w/${slug}/content-studio`);
  revalidatePath(`/w/${slug}/content-studio/${post.id}`);
  revalidatePath(`/w/${slug}/queue`);
  revalidatePath(`/w/${slug}/calendar`);
  redirect(`/w/${slug}/content-studio/${post.id}?saved=1`);
}

export async function submitForApprovalAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const postId = String(formData.get("postId") ?? "");
  const post = await db.post.findFirst({ where: { id: postId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!post) return;
  const reviewer = await db.workspaceMember.findFirst({
    where: { workspaceId: ctx.workspace.id, role: { in: ["admin", "manager"] }, userId: { not: ctx.user.id } },
  });
  await db.$transaction([
    db.post.update({ where: { id: postId }, data: { status: "pending_approval", submittedAt: new Date() } }),
    db.postApproval.create({
      data: { workspaceId: ctx.workspace.id, postId, reviewerId: reviewer?.userId ?? ctx.user.id },
    }),
  ]);
  await createNotification({
    workspaceId: ctx.workspace.id,
    type: "approval_required",
    title: `Approval required: ${post.title ?? "Untitled post"}`,
    body: `${ctx.user.fullName} submitted a post for review.`,
    entityType: "post",
    entityId: post.id,
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.submitted",
    entityType: "post",
    entityId: post.id,
  });
  revalidatePath(`/w/${slug}/approvals`);
  revalidatePath(`/w/${slug}/content-studio/${postId}`);
  redirect(`/w/${slug}/content-studio/${postId}?submitted=1`);
}

export async function decidePostAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_APPROVE);
  const postId = String(formData.get("postId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comments = String(formData.get("comments") ?? "").trim();
  const post = await db.post.findFirst({ where: { id: postId, workspaceId: ctx.workspace.id, deletedAt: null } });
  if (!post) return;
  if (!["approved", "rejected", "revision_requested"].includes(decision)) return;

  const status = decision === "approved" ? "approved" : decision === "rejected" ? "revision_required" : "revision_required";
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id: postId }, data: { status } });
    await tx.postApproval.create({
      data: {
        workspaceId: ctx.workspace.id,
        postId,
        reviewerId: ctx.user.id,
        decision,
        comments: comments || null,
        decidedAt: new Date(),
      },
    });
    await tx.notification.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: post.createdBy,
        type: "approval_decision",
        title: `${decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Revision requested"}: ${post.title ?? "Untitled post"}`,
        body: comments || `${ctx.user.fullName} reviewed your post.`,
        entityType: "post",
        entityId: post.id,
        sentAt: new Date(),
      },
    });
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: `post.${decision}`,
    entityType: "post",
    entityId: post.id,
    metadata: { comments },
  });
  revalidatePath(`/w/${slug}/approvals`);
  revalidatePath(`/w/${slug}/content-studio/${postId}`);
  revalidatePath(`/w/${slug}/dashboard`);
}

export async function schedulePostAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_SCHEDULE);
  const postId = String(formData.get("postId") ?? "");
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) return;
  const post = await db.post.findFirst({ where: { id: postId, workspaceId: ctx.workspace.id }, include: { targets: true } });
  if (!post) return;
  if (post.status === "pending_approval" || post.status === "revision_required") return;
  if (ctx.workspace.approvalRequired && !["approved", "scheduled"].includes(post.status) && ctx.role === "executive") return;
  for (const target of post.targets) {
    if (!["published", "cancelled"].includes(target.status)) await schedulePostTarget(target.id, when);
  }
  await db.post.update({ where: { id: postId }, data: { status: "scheduled" } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.scheduled",
    entityType: "post",
    entityId: postId,
    metadata: { scheduledAt: when.toISOString() },
  });
  revalidatePath(`/w/${slug}/queue`);
  revalidatePath(`/w/${slug}/calendar`);
  revalidatePath(`/w/${slug}/content-studio/${postId}`);
}

export async function publishNowAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_SCHEDULE);
  const postId = String(formData.get("postId") ?? "");
  const post = await db.post.findFirst({ where: { id: postId, workspaceId: ctx.workspace.id }, include: { targets: true } });
  if (!post) return;
  if (ctx.workspace.approvalRequired && ctx.role === "executive" && post.status !== "approved") return;
  for (const target of post.targets) {
    if (!["published", "cancelled"].includes(target.status)) await publishPostTargetNow(target.id);
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.publish_now",
    entityType: "post",
    entityId: postId,
  });
  revalidatePath(`/w/${slug}/queue`);
  revalidatePath(`/w/${slug}/content-studio/${postId}`);
  redirect(`/w/${slug}/queue?published=1`);
}

export async function retryPublishAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_SCHEDULE);
  const jobId = String(formData.get("jobId") ?? "");
  const job = await db.publishJob.findFirst({ where: { id: jobId, workspaceId: ctx.workspace.id } });
  if (!job) return;
  await retryPublishJob(jobId);
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.publish_retry_requested",
    entityType: "publish_job",
    entityId: jobId,
  });
  revalidatePath(`/w/${slug}/queue`);
  redirect(`/w/${slug}/queue?retried=1`);
}

export async function cancelPostAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_SCHEDULE);
  const postId = String(formData.get("postId") ?? "");
  const post = await db.post.findFirst({ where: { id: postId, workspaceId: ctx.workspace.id }, include: { targets: true } });
  if (!post) return;
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id: postId }, data: { status: "cancelled" } });
    await tx.postTarget.updateMany({
      where: { postId, status: { in: ["draft", "scheduled", "queued", "failed"] } },
      data: { status: "cancelled" },
    });
    await tx.publishJob.updateMany({
      where: { postTarget: { postId }, status: { in: ["waiting", "retrying"] } },
      data: { status: "cancelled" },
    });
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.cancelled",
    entityType: "post",
    entityId: postId,
  });
  revalidatePath(`/w/${slug}/queue`);
  revalidatePath(`/w/${slug}/content-studio/${postId}`);
}

export async function deletePostAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_CREATE);
  const postId = String(formData.get("postId") ?? "");
  const post = await db.post.findFirst({ where: { id: postId, workspaceId: ctx.workspace.id } });
  if (!post) return;
  if (post.createdBy !== ctx.user.id && !["admin", "manager"].includes(ctx.role)) return;
  await db.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.deleted",
    entityType: "post",
    entityId: postId,
  });
  revalidatePath(`/w/${slug}/content-studio`);
  redirect(`/w/${slug}/content-studio?deleted=1`);
}

export async function rescheduleTargetAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.POSTS_SCHEDULE);
  const targetId = String(formData.get("targetId") ?? "");
  const scheduledAt = String(formData.get("scheduledAt") ?? "");
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) return;
  const target = await db.postTarget.findFirst({
    where: { id: targetId, workspaceId: ctx.workspace.id },
    include: { post: true },
  });
  if (!target) return;
  if (target.status === "published" || target.status === "cancelled") return;
  await schedulePostTarget(targetId, when);
  const targets = await db.postTarget.findMany({ where: { postId: target.postId }, select: { status: true } });
  await db.post.update({
    where: { id: target.postId },
    data: { status: derivePostStatus(targets, target.post) },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "post.rescheduled",
    entityType: "post_target",
    entityId: targetId,
    metadata: { scheduledAt: when.toISOString() },
  });
  revalidatePath(`/w/${slug}/calendar`);
  revalidatePath(`/w/${slug}/queue`);
}
