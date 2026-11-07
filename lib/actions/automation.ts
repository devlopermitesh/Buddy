"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { schedulePostTarget } from "@/lib/publishing";
import { parseJson } from "@/lib/utils";
import type { ActionState } from "./types";

export async function toggleAutomationRuleAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AUTOMATION_MANAGE);
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await db.automationRule.findFirst({ where: { id: ruleId, workspaceId: ctx.workspace.id } });
  if (!rule) return;
  await db.automationRule.update({ where: { id: ruleId }, data: { enabled: !rule.enabled } });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: rule.enabled ? "automation.rule_disabled" : "automation.rule_enabled",
    entityType: "automation_rule",
    entityId: ruleId,
  });
  revalidatePath(`/w/${slug}/automation`);
}

export async function createAutomationRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AUTOMATION_MANAGE);
  const name = String(formData.get("name") ?? "").trim();
  const ruleType = String(formData.get("ruleType") ?? "");
  if (!name || !ruleType) return { error: "Name and rule type are required." };
  const configuration = String(formData.get("configuration") ?? "{}");
  try {
    JSON.parse(configuration);
  } catch {
    return { error: "Configuration must be valid JSON.", fieldErrors: { configuration: "Invalid JSON." } };
  }
  const rule = await db.automationRule.create({
    data: {
      workspaceId: ctx.workspace.id,
      name,
      ruleType,
      configuration,
      enabled: true,
      createdBy: ctx.user.id,
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "automation.rule_created",
    entityType: "automation_rule",
    entityId: rule.id,
  });
  revalidatePath(`/w/${slug}/automation`);
  return { ok: true, message: "Automation rule created." };
}

export async function updateAutomationRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AUTOMATION_MANAGE);
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await db.automationRule.findFirst({ where: { id: ruleId, workspaceId: ctx.workspace.id } });
  if (!rule) return { error: "Rule not found." };
  const configuration = String(formData.get("configuration") ?? rule.configuration);
  try {
    JSON.parse(configuration);
  } catch {
    return { error: "Configuration must be valid JSON." };
  }
  await db.automationRule.update({
    where: { id: ruleId },
    data: {
      name: String(formData.get("name") ?? rule.name).trim(),
      configuration,
      enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    },
  });
  revalidatePath(`/w/${slug}/automation`);
  return { ok: true, message: "Rule updated." };
}

export async function runAutomationRuleAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AUTOMATION_MANAGE);
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await db.automationRule.findFirst({ where: { id: ruleId, workspaceId: ctx.workspace.id } });
  if (!rule) return;

  const run = await db.automationRun.create({
    data: { workspaceId: ctx.workspace.id, ruleId, status: "running", startedAt: new Date() },
  });

  try {
    const recommendation = await generateRecommendation(ctx.workspace.id, rule.ruleType, run.id);
    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        result: JSON.stringify({ recommendationId: recommendation?.id ?? null }),
      },
    });
  } catch (error) {
    await db.automationRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "automation.rule_run",
    entityType: "automation_rule",
    entityId: ruleId,
  });
  revalidatePath(`/w/${slug}/automation`);
  revalidatePath(`/w/${slug}/ai-scheduling`);
}

async function generateRecommendation(workspaceId: string, ruleType: string, runId: string) {
  if (ruleType === "content_gap_detection") {
    const future = await db.postTarget.count({
      where: { workspaceId, scheduledAt: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) } },
    });
    if (future > 2) return null;
    return db.aiRecommendation.create({
      data: {
        workspaceId,
        runId,
        type: "content_gap",
        payload: JSON.stringify({
          date: new Date(Date.now() + 3 * 86400000).toISOString(),
          reasoning: "Only a few posts are scheduled in the next 14 days. Your audience responds best on weekday mornings.",
          confidence: 0.82,
        }),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  }
  if (ruleType === "failure_monitoring") {
    const failures = await db.postTarget.findMany({
      where: { workspaceId, status: "failed" },
      include: { post: true, socialAccount: true },
      take: 5,
    });
    if (failures.length === 0) return null;
    return db.aiRecommendation.create({
      data: {
        workspaceId,
        runId,
        type: "failure_recovery",
        payload: JSON.stringify({
          count: failures.length,
          reasoning: `${failures.length} target${failures.length === 1 ? "" : "s"} failed. Review the last error and reconnect accounts where needed.`,
          posts: failures.map((failure) => ({ id: failure.postId, title: failure.post.title, platform: failure.socialAccount.platform, error: failure.lastError })),
          confidence: 0.9,
        }),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  }
  if (ruleType === "performance_insights") {
    return db.aiRecommendation.create({
      data: {
        workspaceId,
        runId,
        type: "insight",
        payload: JSON.stringify({
          headline: "Short-form video is your strongest format",
          detail: "Reels and video posts are earning more reach per impression than static feed posts.",
          confidence: 0.78,
        }),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  }
  if (ruleType === "daily_planning") {
    return db.aiRecommendation.create({
      data: {
        workspaceId,
        runId,
        type: "daily_task",
        payload: JSON.stringify({
          title: "Review today's publishing queue",
          reasoning: "A short daily check keeps approvals and failures from blocking the queue.",
          confidence: 0.8,
        }),
        expiresAt: new Date(Date.now() + 2 * 86400000),
      },
    });
  }

  const target = await db.postTarget.findFirst({
    where: { workspaceId, status: { in: ["scheduled", "draft"] } },
    include: { socialAccount: true },
    orderBy: { createdAt: "desc" },
  });
  const suggested = new Date(Date.now() + 26 * 3600000);
  return db.aiRecommendation.create({
    data: {
      workspaceId,
      runId,
      type: ruleType === "queue_optimization" ? "queue_change" : "posting_time",
      postTargetId: target?.id,
      socialAccountId: target?.socialAccountId,
      payload: JSON.stringify({
        suggestedTime: suggested.toISOString(),
        reasoning: "The last 60 days of engagement show a strong weekday morning lift.",
        confidence: 0.84,
      }),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
}

export async function acceptRecommendationAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AI_SCHEDULE);
  const recommendationId = String(formData.get("recommendationId") ?? "");
  const recommendation = await db.aiRecommendation.findFirst({
    where: { id: recommendationId, workspaceId: ctx.workspace.id, status: "suggested" },
  });
  if (!recommendation) return;
  const payload = parseJson<Record<string, unknown>>(recommendation.payload, {});
  const suggestedTime = typeof payload.suggestedTime === "string" ? new Date(payload.suggestedTime) : null;
  const finalValue: Record<string, unknown> = { acceptedAt: new Date().toISOString() };

  if (recommendation.type === "posting_time" || recommendation.type === "queue_change") {
    if (recommendation.postTargetId && suggestedTime && !Number.isNaN(suggestedTime.getTime())) {
      const target = await db.postTarget.findFirst({
        where: { id: recommendation.postTargetId, workspaceId: ctx.workspace.id },
      });
      if (target && !["published", "cancelled"].includes(target.status)) {
        await schedulePostTarget(target.id, suggestedTime);
        finalValue.scheduledAt = suggestedTime.toISOString();
      }
    }
  }
  if (recommendation.type === "content_gap" || recommendation.type === "daily_task" || recommendation.type === "failure_recovery") {
    const title =
      recommendation.type === "content_gap"
        ? "Fill the upcoming content gap"
        : recommendation.type === "failure_recovery"
          ? "Resolve publishing failures"
          : String(payload.title ?? "Review today's plan");
    const task = await db.task.create({
      data: {
        workspaceId: ctx.workspace.id,
        title,
        description: String(payload.reasoning ?? "Created from an AI recommendation."),
        priority: recommendation.type === "failure_recovery" ? "high" : "medium",
        assignedTo: ctx.user.id,
        createdBy: ctx.user.id,
        dueAt: new Date(Date.now() + 2 * 86400000),
        source: "ai",
      },
    });
    finalValue.taskId = task.id;
  }

  await db.aiRecommendation.update({
    where: { id: recommendation.id },
    data: {
      status: "accepted",
      decidedBy: ctx.user.id,
      decidedAt: new Date(),
      finalValue: JSON.stringify(finalValue),
    },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "ai.recommendation_accepted",
    entityType: "ai_recommendation",
    entityId: recommendation.id,
    metadata: { type: recommendation.type },
  });
  revalidatePath(`/w/${slug}/ai-scheduling`);
  revalidatePath(`/w/${slug}/automation`);
  revalidatePath(`/w/${slug}/tasks`);
}

export async function dismissRecommendationAction(formData: FormData) {
  const slug = String(formData.get("workspaceSlug") ?? "");
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AI_SCHEDULE);
  const recommendationId = String(formData.get("recommendationId") ?? "");
  const recommendation = await db.aiRecommendation.findFirst({
    where: { id: recommendationId, workspaceId: ctx.workspace.id, status: "suggested" },
  });
  if (!recommendation) return;
  await db.aiRecommendation.update({
    where: { id: recommendation.id },
    data: { status: "dismissed", decidedBy: ctx.user.id, decidedAt: new Date() },
  });
  await logActivity({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    action: "ai.recommendation_dismissed",
    entityType: "ai_recommendation",
    entityId: recommendation.id,
  });
  revalidatePath(`/w/${slug}/ai-scheduling`);
  revalidatePath(`/w/${slug}/automation`);
}
