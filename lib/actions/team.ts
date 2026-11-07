"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getWorkspaceContext } from "@/lib/auth";
import { canInviteRole, normalizeRole, PERMISSIONS, ROLES, type Role } from "@/lib/permissions";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import type { ActionState } from "./types";

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEMBERS_INVITE);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = normalizeRole(String(formData.get("role") ?? "executive"));
  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  }
  if (!canInviteRole(ctx.role, role)) return { error: "Your role cannot invite that role." };

  const existingMember = await db.workspaceMember.findFirst({
    where: { workspaceId: ctx.workspace.id, user: { email } },
  });
  if (existingMember) return { error: "That person is already a member.", fieldErrors: { email: "Already a member." } };
  const pending = await db.invitation.findFirst({
    where: { workspaceId: ctx.workspace.id, email, status: "pending" },
  });
  if (pending) return { error: "An invitation is already pending.", fieldErrors: { email: "Pending invitation exists." } };

  const token = randomToken(32);
  const invitation = await db.invitation.create({
    data: {
      workspaceId: ctx.workspace.id,
      email,
      role,
      tokenHash: sha256(token),
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const link = `${env.APP_URL}/invite/${token}`;
  await sendMail({
    to: email,
    subject: `You're invited to ${ctx.workspace.name} on SocialFlow`,
    body: `Join ${ctx.workspace.name} as ${role}. This invitation expires in 7 days.`,
    link,
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { email, role },
  });
  revalidatePath(`/w/${slug}/team`);
  return { ok: true, message: `Invitation sent to ${email}.`, devLink: link };
}

export async function resendInvitationAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEMBERS_INVITE);
  const invitationId = String(formData.get("invitationId") ?? "");
  const invitation = await db.invitation.findFirst({
    where: { id: invitationId, workspaceId: ctx.workspace.id, status: "pending" },
  });
  if (!invitation) return;
  const token = randomToken(32);
  await db.invitation.update({
    where: { id: invitation.id },
    data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
  await sendMail({
    to: invitation.email,
    subject: `Reminder: join ${ctx.workspace.name} on SocialFlow`,
    body: `Your invitation to ${ctx.workspace.name} has been refreshed and is valid for 7 days.`,
    link: `${env.APP_URL}/invite/${token}`,
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "invitation.resent",
    entityType: "invitation",
    entityId: invitation.id,
  });
  revalidatePath(`/w/${slug}/team`);
}

export async function revokeInvitationAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEMBERS_INVITE);
  const invitationId = String(formData.get("invitationId") ?? "");
  const invitation = await db.invitation.findFirst({
    where: { id: invitationId, workspaceId: ctx.workspace.id, status: "pending" },
  });
  if (!invitation) return;
  await db.invitation.update({ where: { id: invitation.id }, data: { status: "revoked" } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "invitation.revoked",
    entityType: "invitation",
    entityId: invitation.id,
  });
  revalidatePath(`/w/${slug}/team`);
}

export async function changeMemberRoleAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ROLES_MANAGE);
  const memberId = String(formData.get("memberId") ?? "");
  const role = normalizeRole(String(formData.get("role") ?? "executive"));
  if (!ROLES.includes(role as Role)) return;
  const member = await db.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspace.id } });
  if (!member) return;
  if (member.userId === ctx.workspace.ownerId) return;
  await db.workspaceMember.update({ where: { id: memberId }, data: { role } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "member.role_changed",
    entityType: "workspace_member",
    entityId: memberId,
    metadata: { role },
  });
  await createNotification({
    workspaceId: ctx.workspace.id,
    userId: member.userId,
    type: "task_assigned",
    title: "Your workspace role changed",
    body: `You are now a ${role} in ${ctx.workspace.name}.`,
    entityType: "workspace_member",
    entityId: memberId,
  });
  revalidatePath(`/w/${slug}/team`);
}

export async function removeMemberAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEMBERS_MANAGE);
  const memberId = String(formData.get("memberId") ?? "");
  const member = await db.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspace.id } });
  if (!member) return;
  if (member.userId === ctx.workspace.ownerId) return;
  await db.workspaceMember.update({ where: { id: memberId }, data: { status: "removed" } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "member.removed",
    entityType: "workspace_member",
    entityId: memberId,
  });
  revalidatePath(`/w/${slug}/team`);
}

export async function updateRolePermissionAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ROLES_MANAGE);
  const role = normalizeRole(String(formData.get("role") ?? "executive"));
  const permission = String(formData.get("permission") ?? "");
  const allowed = String(formData.get("allowed") ?? "false") === "true";
  if (!permission) return;
  await db.rolePermission.upsert({
    where: { workspaceId_role_permission: { workspaceId: ctx.workspace.id, role, permission } },
    create: { workspaceId: ctx.workspace.id, role, permission, allowed },
    update: { allowed },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "role.permission_changed",
    entityType: "role_permission",
    entityId: null,
    metadata: { role, permission, allowed },
  });
  revalidatePath(`/w/${slug}/team`);
}

export async function updateMemberOverridesAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ROLES_MANAGE);
  const memberId = String(formData.get("memberId") ?? "");
  const permission = String(formData.get("permission") ?? "");
  const value = String(formData.get("value") ?? "inherit");
  const member = await db.workspaceMember.findFirst({ where: { id: memberId, workspaceId: ctx.workspace.id } });
  if (!member || !permission) return;
  let overrides: Record<string, boolean> = {};
  try {
    overrides = JSON.parse(member.permissionOverrides) as Record<string, boolean>;
  } catch {
    overrides = {};
  }
  if (value === "inherit") delete overrides[permission];
  else overrides[permission] = value === "allow";
  await db.workspaceMember.update({ where: { id: memberId }, data: { permissionOverrides: JSON.stringify(overrides) } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "member.permission_override",
    entityType: "workspace_member",
    entityId: memberId,
    metadata: { permission, value },
  });
  revalidatePath(`/w/${slug}/team`);
}
