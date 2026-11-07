import "server-only";

import { db } from "./db";
import { decryptSecret, randomToken } from "./crypto";
import { createNotification } from "./notifications";
import { logActivity } from "./activity";
import { derivePostStatus } from "./platform-rules";
import { parseJson } from "./utils";

class NonRetryablePublishError extends Error {}

export async function schedulePostTarget(targetId: string, scheduledAt: Date) {
  const target = await db.postTarget.findUnique({
    where: { id: targetId },
    include: { post: true },
  });
  if (!target) throw new Error("Post target not found");

  const idempotencyKey = `${targetId}:${scheduledAt.toISOString()}`;
  const existing = await db.publishJob.findUnique({ where: { idempotencyKey } });

  await db.$transaction(async (tx) => {
    await tx.postTarget.update({
      where: { id: targetId },
      data: { scheduledAt, status: "scheduled", lastError: null },
    });
    if (existing) {
      await tx.publishJob.update({
        where: { id: existing.id },
        data: { runAt: scheduledAt, status: "waiting", nextRetryAt: null, completedAt: null },
      });
    } else {
      await tx.publishJob.create({
        data: {
          workspaceId: target.workspaceId,
          postTargetId: targetId,
          idempotencyKey,
          runAt: scheduledAt,
          status: "waiting",
        },
      });
    }
    const targets = await tx.postTarget.findMany({ where: { postId: target.postId }, select: { status: true } });
    await tx.post.update({
      where: { id: target.postId },
      data: { status: derivePostStatus(targets, target.post) },
    });
  });
}

export async function publishPostTargetNow(targetId: string) {
  const target = await db.postTarget.findUnique({ where: { id: targetId }, include: { post: true } });
  if (!target) throw new Error("Post target not found");
  const now = new Date();
  const idempotencyKey = `${targetId}:now:${now.toISOString()}`;
  await db.$transaction(async (tx) => {
    await tx.postTarget.update({
      where: { id: targetId },
      data: { scheduledAt: now, status: "queued", lastError: null },
    });
    await tx.publishJob.create({
      data: {
        workspaceId: target.workspaceId,
        postTargetId: targetId,
        idempotencyKey,
        runAt: now,
        status: "waiting",
      },
    });
    await tx.post.update({ where: { id: target.postId }, data: { status: "queued" } });
  });
  await processDuePublishJobs(5);
}

export async function retryPublishJob(jobId: string) {
  const job = await db.publishJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Publish job not found");
  await db.$transaction([
    db.publishJob.update({
      where: { id: jobId },
      data: { status: "waiting", runAt: new Date(), nextRetryAt: null, attempts: 0, lockedAt: null, lockedBy: null },
    }),
    db.postTarget.update({ where: { id: job.postTargetId }, data: { status: "queued", lastError: null } }),
  ]);
  await processDuePublishJobs(5);
}

export async function processDuePublishJobs(limit = 20) {
  const now = new Date();
  const jobs = await db.publishJob.findMany({
    where: {
      status: { in: ["waiting", "retrying"] },
      runAt: { lte: now },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const job of jobs) {
    const claimed = await db.publishJob.updateMany({
      where: { id: job.id, status: { in: ["waiting", "retrying"] } },
      data: { status: "running", lockedBy: "in-process-worker", lockedAt: new Date() },
    });
    if (claimed.count === 0) continue;
    await processPublishJob(job.id);
    processed += 1;
  }
  return processed;
}

async function processPublishJob(jobId: string) {
  const job = await db.publishJob.findUnique({
    where: { id: jobId },
    include: {
      postTarget: {
        include: {
          post: { include: { media: { include: { asset: true } } } },
          socialAccount: { include: { credentials: true } },
        },
      },
    },
  });
  if (!job) return;
  const target = job.postTarget;
  const account = target.socialAccount;
  const startedAt = new Date();
  const attemptNumber = job.attempts + 1;
  const metadata = parseJson<Record<string, unknown>>(account.metadata, {});

  try {
    if (target.status === "cancelled") throw new NonRetryablePublishError("Target was cancelled.");
    if (account.status !== "active") {
      throw new NonRetryablePublishError(`Account ${account.accountName} is ${account.status}. Reconnect it before publishing.`);
    }
    if (!account.credentials) {
      throw new NonRetryablePublishError("No stored credentials for this account.");
    }
    if (account.credentials.expiresAt && account.credentials.expiresAt.getTime() < Date.now()) {
      throw new NonRetryablePublishError("The access token has expired. Reconnect the account.");
    }
    if (["pending_approval", "revision_required", "draft"].includes(target.post.status)) {
      throw new NonRetryablePublishError("Post is not approved for publishing.");
    }
    if (metadata.mockFailNext === true) {
      await db.socialAccount.update({
        where: { id: account.id },
        data: { metadata: JSON.stringify({ ...metadata, mockFailNext: false }) },
      });
      throw new NonRetryablePublishError("Mock provider failure requested from Connected Accounts.");
    }
    if (metadata.mockUncertainNext === true) {
      await db.socialAccount.update({
        where: { id: account.id },
        data: { metadata: JSON.stringify({ ...metadata, mockUncertainNext: false }) },
      });
      await db.$transaction([
        db.publishAttempt.create({
          data: {
            jobId,
            attemptNumber,
            result: "unknown",
            responseCode: 0,
            errorCode: "OUTCOME_UNKNOWN",
            errorMessage: "Provider timed out after media container creation. Reconciliation required.",
            startedAt,
            finishedAt: new Date(),
          },
        }),
        db.publishJob.update({
          where: { id: jobId },
          data: { status: "uncertain", attempts: attemptNumber },
        }),
        db.postTarget.update({
          where: { id: target.id },
          data: { status: "publishing", lastError: "Outcome unknown — reconciliation required." },
        }),
      ]);
      return;
    }

    // Decrypt to prove the credential is usable; the mock provider does not send it anywhere.
    decryptSecret(account.credentials.accessTokenEncrypted);
    const externalPostId = `mock_${account.platform}_${randomToken(8).replace(/[^a-zA-Z0-9]/g, "").slice(0, 14)}`;
    const permalink =
      account.platform === "instagram"
        ? `https://www.instagram.com/p/${externalPostId}`
        : `https://www.facebook.com/${account.platformAccountId}/posts/${externalPostId}`;
    const publishedAt = new Date();

    await db.$transaction(async (tx) => {
      await tx.publishAttempt.create({
        data: {
          jobId,
          attemptNumber,
          result: "success",
          responseCode: 200,
          requestSummary: JSON.stringify({
            platform: account.platform,
            accountId: account.platformAccountId,
            format: target.post.format,
            mediaCount: target.post.media.length,
          }),
          responseBody: JSON.stringify({ id: externalPostId, permalink }),
          startedAt,
          finishedAt: new Date(),
        },
      });
      await tx.postTarget.update({
        where: { id: target.id },
        data: {
          status: "published",
          publishedAt,
          externalPostId,
          externalPermalink: permalink,
          lastError: null,
        },
      });
      await tx.publishJob.update({
        where: { id: jobId },
        data: { status: "succeeded", attempts: attemptNumber, completedAt: new Date(), lockedAt: null, lockedBy: null },
      });
      const metrics = mockMetrics(target.id);
      const day = new Date(Date.UTC(publishedAt.getUTCFullYear(), publishedAt.getUTCMonth(), publishedAt.getUTCDate()));
      await tx.analyticsDaily.upsert({
        where: { postTargetId_metricDate: { postTargetId: target.id, metricDate: day } },
        create: {
          workspaceId: target.workspaceId,
          postTargetId: target.id,
          metricDate: day,
          ...metrics,
        },
        update: metrics,
      });
      const accountDay = new Date(day);
      const existingAccountMetric = await tx.accountMetricsDaily.findUnique({
        where: { socialAccountId_metricDate: { socialAccountId: account.id, metricDate: accountDay } },
      });
      if (existingAccountMetric) {
        await tx.accountMetricsDaily.update({
          where: { id: existingAccountMetric.id },
          data: {
            reach: existingAccountMetric.reach + metrics.reach,
            impressions: existingAccountMetric.impressions + metrics.impressions,
            followersGained: existingAccountMetric.followersGained + 3,
          },
        });
      } else {
        await tx.accountMetricsDaily.create({
          data: {
            workspaceId: target.workspaceId,
            socialAccountId: account.id,
            metricDate: accountDay,
            followers: 1000 + Math.floor(Math.random() * 500),
            followersGained: 3,
            reach: metrics.reach,
            impressions: metrics.impressions,
            profileViews: Math.floor(metrics.reach / 20),
            engagementRate: 3.4,
          },
        });
      }
    });

    const allTargets = await db.postTarget.findMany({ where: { postId: target.postId }, select: { status: true } });
    const post = await db.post.findUnique({ where: { id: target.postId } });
    await db.post.update({
      where: { id: target.postId },
      data: { status: derivePostStatus(allTargets, post ?? undefined) },
    });
    await createNotification({
      workspaceId: target.workspaceId,
      userId: target.post.createdBy,
      type: "post_published",
      title: "Post published",
      body: `${target.post.title ?? "Untitled post"} published to ${account.accountName}.`,
      entityType: "post",
      entityId: target.postId,
    });
    await logActivity({
      workspaceId: target.workspaceId,
      actorType: "system",
      action: "post.published",
      entityType: "post",
      entityId: target.postId,
      metadata: { platform: account.platform, externalPostId, permalink },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error";
    const retryable = !(error instanceof NonRetryablePublishError) && attemptNumber < job.maxAttempts;
    const nextRetryAt = retryable ? new Date(Date.now() + Math.pow(2, attemptNumber) * 30_000) : null;

    await db.$transaction(async (tx) => {
      await tx.publishAttempt.create({
        data: {
          jobId,
          attemptNumber,
          result: "failure",
          responseCode: retryable ? 503 : 400,
          errorCode: retryable ? "RETRYABLE" : "NON_RETRYABLE",
          errorMessage: message,
          startedAt,
          finishedAt: new Date(),
        },
      });
      await tx.publishJob.update({
        where: { id: jobId },
        data: retryable
          ? {
              status: "retrying",
              attempts: attemptNumber,
              nextRetryAt,
              runAt: nextRetryAt ?? new Date(),
              lockedAt: null,
              lockedBy: null,
            }
          : {
              status: "failed",
              attempts: attemptNumber,
              completedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            },
      });
      await tx.postTarget.update({
        where: { id: target.id },
        data: { status: "failed", lastError: message },
      });
      const allTargets = await tx.postTarget.findMany({ where: { postId: target.postId }, select: { status: true } });
      const post = await tx.post.findUnique({ where: { id: target.postId } });
      await tx.post.update({
        where: { id: target.postId },
        data: { status: derivePostStatus(allTargets, post ?? undefined) },
      });
    });

    await createNotification({
      workspaceId: target.workspaceId,
      userId: target.post.createdBy,
      type: "publish_failed",
      title: retryable ? "Publishing retry scheduled" : "Publishing failed",
      body: `${target.post.title ?? "Untitled post"}: ${message}`,
      entityType: "post",
      entityId: target.postId,
    });
    await logActivity({
      workspaceId: target.workspaceId,
      actorType: "system",
      action: retryable ? "post.publish_retry" : "post.publish_failed",
      entityType: "post",
      entityId: target.postId,
      metadata: { message, attemptNumber },
    });
  }
}

function mockMetrics(seed: string) {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) % 100000;
  const impressions = 900 + (value % 2400);
  const reach = Math.round(impressions * 0.72);
  return {
    impressions,
    reach,
    likes: Math.round(reach * 0.08),
    comments: Math.round(reach * 0.012),
    shares: Math.round(reach * 0.006),
    saves: Math.round(reach * 0.01),
    clicks: Math.round(reach * 0.02),
    videoViews: Math.round(reach * 0.4),
  };
}

let schedulerStarted = false;

export function startPublishScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = async () => {
    try {
      await processDuePublishJobs();
    } catch (error) {
      console.error("Publish scheduler tick failed", error);
    }
  };
  setTimeout(tick, 2_000);
  setInterval(tick, 15_000);
  console.log("[SocialFlow] in-process publish scheduler started");
}
