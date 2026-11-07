"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import type { ActionState } from "./types";

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.TASKS_MANAGE);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Task title is required.", fieldErrors: { title: "Required." } };
  const assignedTo = String(formData.get("assignedTo") ?? "") || null;
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) return { error: "Choose a valid due date." };

  const task = await db.task.create({
    data: {
      workspaceId: ctx.workspace.id,
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      priority: String(formData.get("priority") ?? "medium"),
      status: "todo",
      assignedTo,
      createdBy: ctx.user.id,
      dueAt,
      campaignId: String(formData.get("campaignId") ?? "") || null,
      postId: String(formData.get("postId") ?? "") || null,
    },
  });
  if (assignedTo && assignedTo !== ctx.user.id) {
    await createNotification({
      workspaceId: ctx.workspace.id,
      userId: assignedTo,
      type: "task_assigned",
      title: `Task assigned: ${title}`,
      body: `${ctx.user.fullName} assigned you a task.`,
      entityType: "task",
      entityId: task.id,
    });
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    metadata: { title },
  });
  revalidatePath(`/w/${slug}/tasks`);
  revalidatePath(`/w/${slug}/dashboard`);
  return { ok: true, message: "Task created." };
}

export async function updateTaskStatusAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.TASKS_MANAGE);
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["todo", "in_progress", "in_review", "done", "cancelled"].includes(status)) return;
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: ctx.workspace.id } });
  if (!task) return;
  if (task.assignedTo !== ctx.user.id && !["admin", "manager"].includes(ctx.role)) return;
  await db.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "task.status_changed",
    entityType: "task",
    entityId: taskId,
    metadata: { status },
  });
  revalidatePath(`/w/${slug}/tasks`);
  revalidatePath(`/w/${slug}/dashboard`);
}

export async function addTaskCommentAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.TASKS_MANAGE);
  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: ctx.workspace.id } });
  if (!task) return;
  await db.taskComment.create({ data: { taskId, userId: ctx.user.id, body } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "task.commented",
    entityType: "task",
    entityId: taskId,
  });
  revalidatePath(`/w/${slug}/tasks`);
}

export async function deleteTaskAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.TASKS_MANAGE);
  const taskId = String(formData.get("taskId") ?? "");
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId: ctx.workspace.id } });
  if (!task) return;
  if (task.createdBy !== ctx.user.id && !["admin", "manager"].includes(ctx.role)) return;
  await db.task.delete({ where: { id: taskId } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "task.deleted",
    entityType: "task",
    entityId: taskId,
  });
  revalidatePath(`/w/${slug}/tasks`);
}

export async function createCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.CAMPAIGNS_MANAGE);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Campaign name is required.", fieldErrors: { name: "Required." } };
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const campaign = await db.campaign.create({
    data: {
      workspaceId: ctx.workspace.id,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      status: String(formData.get("status") ?? "planned"),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      goal: String(formData.get("goal") ?? "").trim() || null,
      color: String(formData.get("color") ?? "#4f46e5"),
      createdBy: ctx.user.id,
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaign.id,
    metadata: { name },
  });
  revalidatePath(`/w/${slug}/campaigns`);
  return { ok: true, message: "Campaign created." };
}

export async function updateCampaignAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.CAMPAIGNS_MANAGE);
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId: ctx.workspace.id } });
  if (!campaign) return;
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      name: String(formData.get("name") ?? campaign.name).trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      status: String(formData.get("status") ?? campaign.status),
      goal: String(formData.get("goal") ?? "").trim() || null,
      color: String(formData.get("color") ?? campaign.color ?? "#4f46e5"),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "campaign.updated",
    entityType: "campaign",
    entityId: campaignId,
  });
  revalidatePath(`/w/${slug}/campaigns`);
  revalidatePath(`/w/${slug}/campaigns/${campaignId}`);
}

export async function archiveCampaignAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.CAMPAIGNS_MANAGE);
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId: ctx.workspace.id } });
  if (!campaign) return;
  await db.campaign.update({ where: { id: campaignId }, data: { status: "archived" } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "campaign.archived",
    entityType: "campaign",
    entityId: campaignId,
  });
  revalidatePath(`/w/${slug}/campaigns`);
}
