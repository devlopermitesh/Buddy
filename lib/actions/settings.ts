"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getWorkspaceContext, hashPassword, verifyPassword } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { parseJson } from "@/lib/utils";
import type { ActionState } from "./types";

export async function markNotificationReadAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug);
  const notificationId = String(formData.get("notificationId") ?? "");
  const notification = await db.notification.findFirst({
    where: { id: notificationId, workspaceId: ctx.workspace.id, OR: [{ userId: ctx.user.id }, { userId: null }] },
  });
  if (!notification) return;
  await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath(`/w/${slug}/notifications`);
  revalidatePath(`/w/${slug}/dashboard`);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug);
  await db.notification.updateMany({
    where: { workspaceId: ctx.workspace.id, OR: [{ userId: ctx.user.id }, { userId: null }], isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath(`/w/${slug}/notifications`);
  revalidatePath(`/w/${slug}/dashboard`);
}

export async function updateNotificationPreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug);
  const preferences = parseJson<Record<string, unknown>>(ctx.user.preferences, {});
  const notifications = {
    inApp: formData.get("inApp") === "on",
    email: formData.get("email") === "on",
    discord: formData.get("discord") === "on",
    published: formData.get("published") === "on",
    failures: formData.get("failures") === "on",
    approvals: formData.get("approvals") === "on",
    dailySummary: formData.get("dailySummary") === "on",
  };
  await db.user.update({
    where: { id: ctx.user.id },
    data: { preferences: JSON.stringify({ ...preferences, notifications }) },
  });
  revalidatePath(`/w/${slug}/notifications`);
  return { ok: true, message: "Notification preferences saved." };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(150),
  timezone: z.string().min(1),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.SETTINGS_PROFILE);
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: { fullName: "Enter your name." } };
  }
  await db.user.update({
    where: { id: ctx.user.id },
    data: { fullName: parsed.data.fullName, timezone: parsed.data.timezone },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "profile.updated",
    entityType: "user",
    entityId: ctx.user.id,
  });
  revalidatePath(`/w/${slug}/settings`);
  return { ok: true, message: "Profile updated." };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.SETTINGS_PROFILE);
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (!ctx.user.passwordHash) return { error: "This account has no password set." };
  const valid = await verifyPassword(ctx.user.passwordHash, current);
  if (!valid) return { error: "Current password is incorrect.", fieldErrors: { currentPassword: "Incorrect password." } };
  if (next.length < 10 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
    return { error: "Use at least 10 characters with upper, lower and numeric characters." };
  }
  await db.user.update({ where: { id: ctx.user.id }, data: { passwordHash: await hashPassword(next) } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "password.changed",
    entityType: "user",
    entityId: ctx.user.id,
  });
  return { ok: true, message: "Password updated." };
}

export async function updateWorkspaceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.WORKSPACE_SETTINGS);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Workspace name is required." };
  const approvalRequired = formData.get("approvalRequired") === "on";
  await db.workspace.update({
    where: { id: ctx.workspace.id },
    data: {
      name,
      defaultTimezone: String(formData.get("timezone") ?? ctx.workspace.defaultTimezone),
      approvalRequired,
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "workspace.updated",
    entityType: "workspace",
    entityId: ctx.workspace.id,
    metadata: { approvalRequired },
  });
  revalidatePath(`/w/${slug}/settings`);
  return { ok: true, message: "Workspace settings saved." };
}

export async function updateUserPreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.SETTINGS_PROFILE);
  const preferences = parseJson<Record<string, unknown>>(ctx.user.preferences, {});
  await db.user.update({
    where: { id: ctx.user.id },
    data: {
      timezone: String(formData.get("timezone") ?? ctx.user.timezone),
      preferences: JSON.stringify({
        ...preferences,
        theme: String(formData.get("theme") ?? "system"),
        defaultLanding: String(formData.get("defaultLanding") ?? "dashboard"),
      }),
    },
  });
  revalidatePath(`/w/${slug}/settings`);
  return { ok: true, message: "Preferences saved." };
}
