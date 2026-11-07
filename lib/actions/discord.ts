"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { parseJson } from "@/lib/utils";
import type { ActionState } from "./types";

const DEFAULT_COMMANDS = ["dashboard", "posts", "tasks", "publish-status", "approvals", "configure"];

const DEFAULT_COMMAND_PERMISSIONS = {
  admin: DEFAULT_COMMANDS,
  manager: DEFAULT_COMMANDS.filter((command) => command !== "configure"),
  executive: DEFAULT_COMMANDS.filter((command) =>
    ["dashboard", "posts", "tasks", "publish-status"].includes(command),
  ),
};

/**
 * Mock Discord server connection used by the Discord Integration page when no
 * server is linked yet. The real OAuth flow lives on the onboarding step; this
 * action follows the same permission and validation rules.
 */
export async function connectDiscordServerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_CONFIGURE);
  const guildId = String(formData.get("discordGuildId") ?? "").trim();
  const guildName = String(formData.get("guildName") ?? "").trim();
  const notificationChannelId = String(formData.get("notificationChannelId") ?? "").trim();

  if (!guildName) return { error: "Enter the Discord server name." };
  if (!/^\d{10,30}$/.test(guildId)) {
    return {
      error: "Enter a valid Discord server ID (numeric).",
      fieldErrors: { discordGuildId: "Numeric server ID required." },
    };
  }

  const existing = await db.discordIntegration.findUnique({ where: { workspaceId: ctx.workspace.id } });
  if (existing && existing.botStatus !== "disconnected") {
    return { error: "This workspace already has a connected Discord server." };
  }

  const data = {
    discordGuildId: guildId,
    guildName,
    botStatus: "connected",
    notificationChannelId: notificationChannelId || null,
    notificationSettings: JSON.stringify({
      published: true,
      failed: true,
      approvalRequired: true,
      upcomingPost: true,
      dailySummary: false,
      weeklyReport: false,
    }),
    commandPermissions: JSON.stringify(DEFAULT_COMMAND_PERMISSIONS),
    connectedBy: ctx.user.id,
    connectedAt: new Date(),
    disconnectedAt: null,
  };

  const integration = existing
    ? await db.discordIntegration.update({ where: { id: existing.id }, data })
    : await db.discordIntegration.create({ data: { workspaceId: ctx.workspace.id, ...data } });

  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "discord.connected",
    entityType: "discord_integration",
    entityId: integration.id,
    metadata: { guildId, guildName },
  });
  revalidatePath(`/w/${slug}/discord`);
  return { ok: true, message: "Discord server connected. A test message was sent." };
}

export async function updateDiscordSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_CONFIGURE);
  const integration = await db.discordIntegration.findUnique({ where: { workspaceId: ctx.workspace.id } });
  if (!integration) return { error: "Connect a Discord server first." };
  const notificationSettings = {
    published: formData.get("published") === "on",
    failed: formData.get("failed") === "on",
    approvalRequired: formData.get("approvalRequired") === "on",
    upcomingPost: formData.get("upcomingPost") === "on",
    dailySummary: formData.get("dailySummary") === "on",
    weeklyReport: formData.get("weeklyReport") === "on",
  };
  await db.discordIntegration.update({
    where: { id: integration.id },
    data: {
      notificationChannelId: String(formData.get("notificationChannelId") ?? "").trim() || null,
      approvalsChannelId: String(formData.get("approvalsChannelId") ?? "").trim() || null,
      alertsChannelId: String(formData.get("alertsChannelId") ?? "").trim() || null,
      reportsChannelId: String(formData.get("reportsChannelId") ?? "").trim() || null,
      notificationSettings: JSON.stringify(notificationSettings),
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "discord.settings_updated",
    entityType: "discord_integration",
    entityId: integration.id,
  });
  revalidatePath(`/w/${slug}/discord`);
  return { ok: true, message: "Discord settings saved." };
}

export async function updateCommandPermissionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_CONFIGURE);
  const integration = await db.discordIntegration.findUnique({ where: { workspaceId: ctx.workspace.id } });
  if (!integration) return { error: "Connect a Discord server first." };
  const commands = formData.getAll("commands").map(String);
  const permissions = {
    admin: commands,
    manager: commands.filter((command) => command !== "configure"),
    executive: commands.filter((command) => ["dashboard", "posts", "tasks", "publish-status"].includes(command)),
  };
  await db.discordIntegration.update({
    where: { id: integration.id },
    data: { commandPermissions: JSON.stringify(permissions) },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "discord.command_permissions_updated",
    entityType: "discord_integration",
    entityId: integration.id,
  });
  revalidatePath(`/w/${slug}/discord`);
  return { ok: true, message: "Command permissions saved." };
}

export async function linkDiscordUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_VIEW);
  const discordUserId = String(formData.get("discordUserId") ?? "").trim();
  const discordUsername = String(formData.get("discordUsername") ?? "").trim();
  if (!discordUserId || !/^\d{10,30}$/.test(discordUserId)) {
    return { error: "Enter a valid Discord user ID (numeric).", fieldErrors: { discordUserId: "Numeric Discord ID required." } };
  }
  const existing = await db.discordUserLink.findFirst({
    where: { workspaceId: ctx.workspace.id, discordUserId, NOT: { userId: ctx.user.id } },
  });
  if (existing) return { error: "That Discord account is already linked to another member." };
  await db.discordUserLink.upsert({
    where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: ctx.user.id } },
    create: {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      discordUserId,
      discordUsername: discordUsername || null,
      verifiedAt: new Date(),
    },
    update: { discordUserId, discordUsername: discordUsername || null, verifiedAt: new Date() },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "discord.user_linked",
    entityType: "discord_user_link",
    entityId: ctx.user.id,
  });
  revalidatePath(`/w/${slug}/discord`);
  return { ok: true, message: "Discord account linked." };
}

export async function unlinkDiscordUserAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_VIEW);
  await db.discordUserLink.deleteMany({ where: { workspaceId: ctx.workspace.id, userId: ctx.user.id } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "discord.user_unlinked",
    entityType: "discord_user_link",
    entityId: ctx.user.id,
  });
  revalidatePath(`/w/${slug}/discord`);
}

export async function disconnectDiscordAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_CONFIGURE);
  const integration = await db.discordIntegration.findUnique({ where: { workspaceId: ctx.workspace.id } });
  if (!integration) return;
  await db.discordIntegration.update({
    where: { id: integration.id },
    data: { botStatus: "disconnected", disconnectedAt: new Date() },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "discord.disconnected",
    entityType: "discord_integration",
    entityId: integration.id,
  });
  revalidatePath(`/w/${slug}/discord`);
}

export async function testDiscordCommandAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.DISCORD_VIEW);
  const command = String(formData.get("command") ?? "dashboard");
  const integration = await db.discordIntegration.findUnique({ where: { workspaceId: ctx.workspace.id } });
  if (!integration) return;
  const link = await db.discordUserLink.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: ctx.user.id } },
  });
  const permissions = parseJson<Record<string, string[]>>(integration.commandPermissions, {});
  const roleCommands = permissions[ctx.role] ?? [];
  const allowed = Boolean(link) && roleCommands.includes(command);
  await db.discordCommand.create({
    data: {
      workspaceId: ctx.workspace.id,
      integrationId: integration.id,
      userId: ctx.user.id,
      discordUserId: link?.discordUserId ?? "unlinked",
      command,
      arguments: JSON.stringify({ source: "ui-test" }),
      status: allowed ? "executed" : "rejected",
      result: allowed ? JSON.stringify({ ok: true, demo: true }) : null,
      rejectionReason: !link
        ? "Discord user is not linked."
        : `Role ${ctx.role} is not allowed to run /${command}.`,
      executedAt: new Date(),
    },
  });
  revalidatePath(`/w/${slug}/discord`);
}
