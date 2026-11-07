"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "./types";

export type ReportTotals = {
  posts: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  videoViews: number;
  engagement: number;
};

export type ReportData = {
  type: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  totals: ReportTotals;
  byPlatform: (ReportTotals & { platform: string })[];
  topPosts: { postId: string; title: string; platform: string; reach: number; engagement: number }[];
};

function emptyTotals(): ReportTotals {
  return {
    posts: 0,
    impressions: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    videoViews: 0,
    engagement: 0,
  };
}

export async function generateReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.REPORTS_VIEW);
  const type = String(formData.get("type") ?? "weekly");
  const periodStartRaw = String(formData.get("periodStart") ?? "");
  const periodEndRaw = String(formData.get("periodEnd") ?? "");
  const periodEnd = periodEndRaw ? new Date(periodEndRaw) : new Date();
  const periodStart = periodStartRaw ? new Date(periodStartRaw) : new Date(periodEnd.getTime() - 7 * 86400000);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "Choose a valid reporting period." };
  }
  if (periodStart > periodEnd) return { error: "The start date must be before the end date." };

  const targets = await db.postTarget.findMany({
    where: {
      workspaceId: ctx.workspace.id,
      analytics: { some: { metricDate: { gte: periodStart, lte: periodEnd } } },
    },
    include: {
      socialAccount: true,
      post: true,
      analytics: { where: { metricDate: { gte: periodStart, lte: periodEnd } } },
    },
  });

  const totals = emptyTotals();
  const platformMap = new Map<string, ReportTotals>();
  const posts: { postId: string; title: string; platform: string; reach: number; engagement: number }[] = [];

  for (const target of targets) {
    const platform = target.socialAccount.platform;
    const row = platformMap.get(platform) ?? emptyTotals();
    let targetReach = 0;
    let targetEngagement = 0;
    for (const metric of target.analytics) {
      totals.impressions += metric.impressions;
      totals.reach += metric.reach;
      totals.likes += metric.likes;
      totals.comments += metric.comments;
      totals.shares += metric.shares;
      totals.saves += metric.saves;
      totals.clicks += metric.clicks;
      totals.videoViews += metric.videoViews;
      row.impressions += metric.impressions;
      row.reach += metric.reach;
      row.likes += metric.likes;
      row.comments += metric.comments;
      row.shares += metric.shares;
      row.saves += metric.saves;
      row.clicks += metric.clicks;
      row.videoViews += metric.videoViews;
      targetReach += metric.reach;
      targetEngagement += metric.likes + metric.comments + metric.shares + metric.saves;
    }
    totals.posts += 1;
    row.posts += 1;
    totals.engagement += targetEngagement;
    row.engagement += targetEngagement;
    platformMap.set(platform, row);
    posts.push({
      postId: target.postId,
      title: target.post.title ?? target.post.baseCaption?.slice(0, 60) ?? "Untitled post",
      platform,
      reach: targetReach,
      engagement: targetEngagement,
    });
  }

  const data: ReportData = {
    type,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    totals,
    byPlatform: Array.from(platformMap.entries()).map(([platform, row]) => ({ platform, ...row })),
    topPosts: posts.sort((a, b) => b.engagement - a.engagement).slice(0, 5),
  };

  const report = await db.report.create({
    data: {
      workspaceId: ctx.workspace.id,
      type,
      periodStart,
      periodEnd,
      data: JSON.stringify(data),
      generatedBy: ctx.user.id,
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "report.generated",
    entityType: "report",
    entityId: report.id,
    metadata: { type, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
  });
  revalidatePath(`/w/${slug}/reports`);
  return { ok: true, message: "Report generated.", data: { reportId: report.id } };
}

export async function deleteReportAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.REPORTS_VIEW);
  const reportId = String(formData.get("reportId") ?? "");
  const report = await db.report.findFirst({ where: { id: reportId, workspaceId: ctx.workspace.id } });
  if (!report) return;
  await db.report.delete({ where: { id: reportId } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "report.deleted",
    entityType: "report",
    entityId: reportId,
  });
  revalidatePath(`/w/${slug}/reports`);
}
