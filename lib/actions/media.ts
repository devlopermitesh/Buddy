"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadMediaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEDIA_MANAGE);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { error: "Files must be 10 MB or smaller." };
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    return { error: "Only image and video files are supported." };
  }

  const folder = String(formData.get("folder") ?? "").trim() || null;
  const altText = String(formData.get("altText") ?? "").trim() || null;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : mime.split("/")[1];
  const safeExt = (ext ?? "bin").replace(/[^a-z0-9]/g, "").slice(0, 8);
  const key = `${randomUUID()}.${safeExt}`;
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, key), buffer);

  const asset = await db.mediaAsset.create({
    data: {
      workspaceId: ctx.workspace.id,
      uploadedBy: ctx.user.id,
      type: mime.startsWith("video/") ? "video" : "image",
      fileName: file.name,
      storageKey: `local/${key}`,
      publicUrl: `/uploads/${key}`,
      thumbnailUrl: mime.startsWith("image/") ? `/uploads/${key}` : null,
      mimeType: mime,
      sizeBytes: file.size,
      width: mime.startsWith("image/") ? 1080 : null,
      height: mime.startsWith("image/") ? 1080 : null,
      altText,
      folder,
      tags: JSON.stringify(tags),
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "media.uploaded",
    entityType: "media_asset",
    entityId: asset.id,
    metadata: { fileName: file.name, size: file.size },
  });
  revalidatePath(`/w/${slug}/media`);
  return { ok: true, message: "Asset uploaded.", data: { id: asset.id, url: asset.publicUrl } };
}

export async function updateMediaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEDIA_MANAGE);
  const id = String(formData.get("mediaId") ?? "");
  const asset = await db.mediaAsset.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!asset) return { error: "Asset not found." };
  const altText = String(formData.get("altText") ?? "").trim() || null;
  const folder = String(formData.get("folder") ?? "").trim() || null;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  await db.mediaAsset.update({ where: { id }, data: { altText, folder, tags: JSON.stringify(tags) } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "media.updated",
    entityType: "media_asset",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/media`);
  return { ok: true, message: "Asset updated." };
}

export async function deleteMediaAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.MEDIA_MANAGE);
  const id = String(formData.get("mediaId") ?? "");
  const asset = await db.mediaAsset.findFirst({ where: { id, workspaceId: ctx.workspace.id } });
  if (!asset) return;
  const used = await db.postMedia.count({ where: { mediaAssetId: id } });
  if (used > 0) return;
  await db.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "media.deleted",
    entityType: "media_asset",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/media`);
}
