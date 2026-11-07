"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { encryptSecret, randomToken } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { parseJson } from "@/lib/utils";
import type { ActionState } from "./types";

export async function connectAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ACCOUNTS_CONNECT);
  const platform = String(formData.get("platform") ?? "");
  if (platform !== "instagram" && platform !== "facebook") return { error: "Choose Instagram or Facebook." };
  const accountName = String(formData.get("accountName") ?? "").trim();
  if (!accountName) return { error: "Account name is required.", fieldErrors: { accountName: "Required." } };

  const platformAccountId = `${platform === "instagram" ? "178414" : "102938"}${Math.floor(Math.random() * 900000000 + 100000000)}`;
  const existing = await db.socialAccount.findUnique({
    where: { platform_platformAccountId: { platform, platformAccountId } },
  });
  if (existing) {
    return { error: `That account is already connected to ${existing.workspaceId === ctx.workspace.id ? "this workspace" : "another workspace"}.` };
  }

  const account = await db.socialAccount.create({
    data: {
      workspaceId: ctx.workspace.id,
      platform,
      platformAccountId,
      accountName,
      username: String(formData.get("username") ?? "").trim() || null,
      profilePictureUrl: "/uploads/seed-1.svg",
      connectedBy: ctx.user.id,
      metadata: JSON.stringify({ followers: 0, mockFailNext: false, mockUncertainNext: false }),
    },
  });
  await db.socialCredential.create({
    data: {
      socialAccountId: account.id,
      accessTokenEncrypted: encryptSecret(`mock-${platform}-${randomToken(12)}`),
      refreshTokenEncrypted: encryptSecret(`mock-${platform}-refresh-${randomToken(12)}`),
      encryptionKeyId: "local-dev-key",
      scopes: JSON.stringify(platform === "instagram" ? ["instagram_basic", "instagram_content_publish"] : ["pages_manage_posts"]),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "account.connected",
    entityType: "social_account",
    entityId: account.id,
    metadata: { platform, mode: "mock" },
  });
  revalidatePath(`/w/${slug}/accounts`);
  revalidatePath(`/w/${slug}/dashboard`);
  return { ok: true, message: `${accountName} connected (mock OAuth).` };
}

export async function reconnectAccountAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ACCOUNTS_CONNECT);
  const accountId = String(formData.get("accountId") ?? "");
  const account = await db.socialAccount.findFirst({ where: { id: accountId, workspaceId: ctx.workspace.id } });
  if (!account) return;
  await db.socialAccount.update({
    where: { id: accountId },
    data: { status: "active", disconnectedAt: null, lastSyncedAt: new Date() },
  });
  await db.socialCredential.updateMany({
    where: { socialAccountId: accountId },
    data: {
      accessTokenEncrypted: encryptSecret(`mock-${account.platform}-reconnected-${randomToken(12)}`),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      lastRefreshedAt: new Date(),
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "account.reconnected",
    entityType: "social_account",
    entityId: accountId,
  });
  revalidatePath(`/w/${slug}/accounts`);
  revalidatePath(`/w/${slug}/dashboard`);
}

export async function disconnectAccountAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ACCOUNTS_MANAGE);
  const accountId = String(formData.get("accountId") ?? "");
  const account = await db.socialAccount.findFirst({
    where: { id: accountId, workspaceId: ctx.workspace.id },
    include: { targets: { include: { publishJobs: true } } },
  });
  if (!account) return;
  await db.$transaction(async (tx) => {
    await tx.socialAccount.update({
      where: { id: accountId },
      data: { status: "disconnected", disconnectedAt: new Date() },
    });
    const targetIds = account.targets.map((target) => target.id);
    if (targetIds.length > 0) {
      await tx.postTarget.updateMany({
        where: { id: { in: targetIds }, status: { in: ["scheduled", "queued", "failed"] } },
        data: { status: "cancelled", lastError: "Account disconnected." },
      });
      await tx.publishJob.updateMany({
        where: { postTargetId: { in: targetIds }, status: { in: ["waiting", "retrying"] } },
        data: { status: "cancelled" },
      });
    }
  });
  await createNotification({
    workspaceId: ctx.workspace.id,
    type: "token_expiring",
    title: `${account.accountName} disconnected`,
    body: "Queued jobs for this account were cancelled. Reconnect to resume publishing.",
    entityType: "social_account",
    entityId: accountId,
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "account.disconnected",
    entityType: "social_account",
    entityId: accountId,
  });
  revalidatePath(`/w/${slug}/accounts`);
  revalidatePath(`/w/${slug}/queue`);
}

export async function setMockFailureAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ACCOUNTS_MANAGE);
  const accountId = String(formData.get("accountId") ?? "");
  const mode = String(formData.get("mode") ?? "fail");
  const account = await db.socialAccount.findFirst({ where: { id: accountId, workspaceId: ctx.workspace.id } });
  if (!account) return;
  const metadata = parseJson<Record<string, unknown>>(account.metadata, {});
  const next = {
    ...metadata,
    mockFailNext: mode === "fail" ? true : false,
    mockUncertainNext: mode === "uncertain" ? true : false,
  };
  await db.socialAccount.update({ where: { id: accountId }, data: { metadata: JSON.stringify(next) } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "account.mock_failure_armed",
    entityType: "social_account",
    entityId: accountId,
    metadata: { mode },
  });
  revalidatePath(`/w/${slug}/accounts`);
}

export async function syncAccountAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.ACCOUNTS_CONNECT);
  const accountId = String(formData.get("accountId") ?? "");
  const account = await db.socialAccount.findFirst({ where: { id: accountId, workspaceId: ctx.workspace.id } });
  if (!account) return;
  await db.socialAccount.update({ where: { id: accountId }, data: { lastSyncedAt: new Date() } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "account.synced",
    entityType: "social_account",
    entityId: accountId,
  });
  revalidatePath(`/w/${slug}/accounts`);
}
