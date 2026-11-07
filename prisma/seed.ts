import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { encryptSecret } from "../lib/crypto";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type Role } from "../lib/permissions";

const db = new PrismaClient();

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const MANAGER_ID = "22222222-2222-2222-2222-222222222222";
const EXEC_ID = "33333333-3333-3333-3333-333333333333";
const WORKSPACE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEV_PASSWORD = "Password123!";

const now = new Date();
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000);
const atHour = (days: number, hour: number) => {
  const d = daysAgo(days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

function json(value: unknown) {
  return JSON.stringify(value);
}

function metrics(seed: number) {
  const impressions = 700 + ((seed * 977) % 3200);
  const reach = Math.round(impressions * 0.71);
  return {
    impressions,
    reach,
    likes: Math.round(reach * 0.075),
    comments: Math.round(reach * 0.011),
    shares: Math.round(reach * 0.005),
    saves: Math.round(reach * 0.009),
    clicks: Math.round(reach * 0.018),
    videoViews: Math.round(reach * 0.35),
  };
}

function ensurePlaceholders() {
  const dir = join(process.cwd(), "public", "uploads");
  mkdirSync(dir, { recursive: true });
  const palettes = [
    ["#4f46e5", "#8b5cf6", "Summer Launch"],
    ["#0ea5e9", "#22d3ee", "Behind the Scenes"],
    ["#f59e0b", "#ef4444", "Weekend Edit"],
    ["#10b981", "#34d399", "New Collection"],
    ["#ec4899", "#8b5cf6", "Community"],
    ["#64748b", "#334155", "Studio Still"],
    ["#0f172a", "#2563eb", "Product Detail"],
    ["#f97316", "#facc15", "Flash Sale"],
  ];
  palettes.forEach(([from, to, label], index) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <circle cx="840" cy="220" r="280" fill="rgba(255,255,255,0.12)"/>
  <circle cx="180" cy="880" r="340" fill="rgba(255,255,255,0.08)"/>
  <text x="72" y="900" font-family="Inter, Arial, sans-serif" font-size="76" font-weight="700" fill="white">${label}</text>
  <text x="76" y="960" font-family="Inter, Arial, sans-serif" font-size="34" fill="rgba(255,255,255,0.75)">SocialFlow demo asset</text>
</svg>`;
    writeFileSync(join(dir, `seed-${index + 1}.svg`), svg, "utf8");
  });
}

async function clear() {
  await db.publishAttempt.deleteMany();
  await db.publishJob.deleteMany();
  await db.analyticsDaily.deleteMany();
  await db.accountMetricsDaily.deleteMany();
  await db.aiRecommendation.deleteMany();
  await db.automationRun.deleteMany();
  await db.automationRule.deleteMany();
  await db.taskComment.deleteMany();
  await db.task.deleteMany();
  await db.postApproval.deleteMany();
  await db.postHashtag.deleteMany();
  await db.postMedia.deleteMany();
  await db.postTarget.deleteMany();
  await db.post.deleteMany();
  await db.hashtag.deleteMany();
  await db.mediaAsset.deleteMany();
  await db.campaign.deleteMany();
  await db.postingSlot.deleteMany();
  await db.socialCredential.deleteMany();
  await db.socialAccount.deleteMany();
  await db.report.deleteMany();
  await db.notification.deleteMany();
  await db.activityLog.deleteMany();
  await db.discordCommand.deleteMany();
  await db.discordUserLink.deleteMany();
  await db.discordIntegration.deleteMany();
  await db.invitation.deleteMany();
  await db.authToken.deleteMany();
  await db.userSession.deleteMany();
  await db.rolePermission.deleteMany();
  await db.workspaceMember.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
  await db.emailOutbox.deleteMany();
}

async function main() {
  ensurePlaceholders();
  await clear();

  const passwordHash = await hash(DEV_PASSWORD, { memoryCost: 19456, timeCost: 2 });

  const admin = await db.user.create({
    data: {
      id: ADMIN_ID,
      email: "admin@socialflow.test",
      fullName: "Alice Admin",
      passwordHash,
      emailVerifiedAt: daysAgo(120),
      lastLoginAt: daysAgo(0),
      timezone: "UTC",
      preferences: json({ theme: "system", emailNotifications: true, discordNotifications: true }),
    },
  });
  const manager = await db.user.create({
    data: {
      id: MANAGER_ID,
      email: "manager@socialflow.test",
      fullName: "Bob Manager",
      passwordHash,
      emailVerifiedAt: daysAgo(110),
      lastLoginAt: daysAgo(0),
      timezone: "America/New_York",
      preferences: json({ theme: "system", emailNotifications: true, discordNotifications: true }),
    },
  });
  const executive = await db.user.create({
    data: {
      id: EXEC_ID,
      email: "exec@socialflow.test",
      fullName: "Candice Executive",
      passwordHash,
      emailVerifiedAt: daysAgo(100),
      lastLoginAt: daysAgo(1),
      timezone: "Europe/London",
      preferences: json({ theme: "system", emailNotifications: true, discordNotifications: false }),
    },
  });

  const workspace = await db.workspace.create({
    data: {
      id: WORKSPACE_ID,
      name: "Demo Brand",
      slug: "demo-brand",
      ownerId: admin.id,
      defaultTimezone: "UTC",
      onboardingStep: 5,
      onboardingCompletedAt: daysAgo(100),
      approvalRequired: true,
      settings: json({ brandColor: "#4f46e5", industry: "Consumer goods" }),
    },
  });

  await db.workspaceMember.createMany({
    data: [
      { workspaceId: workspace.id, userId: admin.id, role: "admin", joinedAt: daysAgo(100) },
      { workspaceId: workspace.id, userId: manager.id, role: "manager", joinedAt: daysAgo(95) },
      { workspaceId: workspace.id, userId: executive.id, role: "executive", joinedAt: daysAgo(90) },
    ],
  });

  const roleRows = (Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[]).flatMap((role) =>
    ALL_PERMISSIONS.map((permission) => ({
      workspaceId: workspace.id,
      role,
      permission,
      allowed: DEFAULT_ROLE_PERMISSIONS[role].includes(permission),
    })),
  );
  await db.rolePermission.createMany({ data: roleRows });

  const instagram = await db.socialAccount.create({
    data: {
      workspaceId: workspace.id,
      platform: "instagram",
      platformAccountId: "17841400000000001",
      accountName: "Demo Brand",
      username: "@demo.brand",
      profilePictureUrl: "/uploads/seed-1.svg",
      linkedPageId: "102938475610293",
      status: "active",
      connectedBy: admin.id,
      connectedAt: daysAgo(100),
      lastSyncedAt: new Date(),
      metadata: json({ followers: 18420, mockFailNext: false, mockUncertainNext: false }),
    },
  });
  await db.socialCredential.create({
    data: {
      socialAccountId: instagram.id,
      accessTokenEncrypted: encryptSecret("mock-instagram-access-token"),
      refreshTokenEncrypted: encryptSecret("mock-instagram-refresh-token"),
      encryptionKeyId: "local-dev-key",
      scopes: json(["instagram_basic", "instagram_content_publish", "pages_show_list"]),
      expiresAt: daysFromNow(5),
      lastRefreshedAt: daysAgo(1),
    },
  });

  const facebook = await db.socialAccount.create({
    data: {
      workspaceId: workspace.id,
      platform: "facebook",
      platformAccountId: "102938475610293",
      accountName: "Demo Brand Page",
      username: "@demobrandpage",
      profilePictureUrl: "/uploads/seed-2.svg",
      status: "active",
      connectedBy: manager.id,
      connectedAt: daysAgo(98),
      lastSyncedAt: new Date(),
      metadata: json({ followers: 9210, mockFailNext: false, mockUncertainNext: false }),
    },
  });
  await db.socialCredential.create({
    data: {
      socialAccountId: facebook.id,
      accessTokenEncrypted: encryptSecret("mock-facebook-access-token"),
      refreshTokenEncrypted: encryptSecret("mock-facebook-refresh-token"),
      encryptionKeyId: "local-dev-key",
      scopes: json(["pages_manage_posts", "pages_read_engagement", "pages_show_list"]),
      expiresAt: daysFromNow(45),
      lastRefreshedAt: daysAgo(1),
    },
  });

  await db.socialAccount.create({
    data: {
      workspaceId: workspace.id,
      platform: "facebook",
      platformAccountId: "908172635409182",
      accountName: "Demo Brand Archive",
      username: "@demobrandarchive",
      status: "disconnected",
      connectedBy: admin.id,
      connectedAt: daysAgo(200),
      disconnectedAt: daysAgo(40),
      metadata: json({ followers: 3200 }),
    },
  });

  const assetDefs = [
    { name: "Summer launch hero", type: "image", file: "seed-1.svg", folder: "Campaigns", tags: ["summer", "launch"], alt: "Gradient artwork for the summer launch" },
    { name: "Behind the scenes", type: "image", file: "seed-2.svg", folder: "Reels", tags: ["bts", "team"], alt: "Behind the scenes gradient" },
    { name: "Weekend edit", type: "image", file: "seed-3.svg", folder: "Social", tags: ["weekend"], alt: "Weekend edit gradient" },
    { name: "New collection", type: "image", file: "seed-4.svg", folder: "Campaigns", tags: ["collection"], alt: "New collection gradient" },
    { name: "Community spotlight", type: "image", file: "seed-5.svg", folder: "Community", tags: ["community", "ugc"], alt: "Community spotlight gradient" },
    { name: "Studio still", type: "image", file: "seed-6.svg", folder: "Studio", tags: ["studio"], alt: "Studio still gradient" },
    { name: "Product detail", type: "image", file: "seed-7.svg", folder: "Products", tags: ["product"], alt: "Product detail gradient" },
    { name: "Flash sale", type: "image", file: "seed-8.svg", folder: "Campaigns", tags: ["sale", "promo"], alt: "Flash sale gradient" },
  ];
  const assets = [];
  for (const [index, asset] of assetDefs.entries()) {
    assets.push(
      await db.mediaAsset.create({
        data: {
          workspaceId: workspace.id,
          uploadedBy: index % 2 === 0 ? admin.id : manager.id,
          type: asset.type,
          fileName: asset.file,
          storageKey: `local/${asset.file}`,
          publicUrl: `/uploads/${asset.file}`,
          thumbnailUrl: `/uploads/${asset.file}`,
          mimeType: "image/svg+xml",
          sizeBytes: 1800 + index * 120,
          width: 1080,
          height: 1080,
          altText: asset.alt,
          folder: asset.folder,
          tags: json(asset.tags),
          createdAt: daysAgo(30 - index * 2),
        },
      }),
    );
  }

  const campaignA = await db.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Summer Launch",
      description: "Launch the summer capsule across Instagram and Facebook.",
      status: "active",
      startDate: daysAgo(12),
      endDate: daysFromNow(18),
      goal: "Reach 250k impressions and 4% engagement",
      color: "#4f46e5",
      createdBy: admin.id,
    },
  });
  const campaignB = await db.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Community Spotlight",
      description: "Weekly user-generated content series.",
      status: "planned",
      startDate: daysFromNow(3),
      endDate: daysFromNow(45),
      goal: "Build community engagement",
      color: "#10b981",
      createdBy: manager.id,
    },
  });
  const campaignC = await db.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Q4 Flash Sales",
      description: "Three flash sale moments in Q4.",
      status: "paused",
      startDate: daysAgo(60),
      endDate: daysAgo(10),
      goal: "Drive revenue",
      color: "#f97316",
      createdBy: admin.id,
    },
  });

  const hashtags = [];
  for (const tag of ["summer", "launch", "demobrand", "community", "behindthescenes", "newcollection"]) {
    hashtags.push(
      await db.hashtag.create({
        data: { workspaceId: workspace.id, tag, groupName: tag === "summer" || tag === "launch" ? "Summer" : "Brand", useCount: 3 },
      }),
    );
  }

  type PostDef = {
    title: string;
    caption: string;
    format: string;
    status: string;
    campaignId?: string;
    createdAt: Date;
    submittedAt?: Date;
    assetIndexes: number[];
    targets: { account: "instagram" | "facebook"; status: string; scheduledAt?: Date; publishedAt?: Date; error?: string }[];
    approval?: "pending" | "approved" | "revision_requested" | "rejected";
  };

  const postDefs: PostDef[] = [
    {
      title: "Summer launch hero",
      caption: "The summer capsule is here. Lightweight layers, bold color, made for long days. #summer #launch #demobrand",
      format: "feed_post",
      status: "published",
      campaignId: campaignA.id,
      createdAt: daysAgo(18),
      submittedAt: daysAgo(17),
      assetIndexes: [0],
      targets: [
        { account: "instagram", status: "published", publishedAt: daysAgo(15), scheduledAt: daysAgo(15) },
        { account: "facebook", status: "published", publishedAt: daysAgo(15), scheduledAt: daysAgo(15) },
      ],
      approval: "approved",
    },
    {
      title: "Behind the scenes reel",
      caption: "A peek at the studio before launch day. #behindthescenes #demobrand",
      format: "reel",
      status: "published",
      campaignId: campaignA.id,
      createdAt: daysAgo(14),
      submittedAt: daysAgo(13),
      assetIndexes: [1],
      targets: [
        { account: "instagram", status: "published", publishedAt: daysAgo(11), scheduledAt: daysAgo(11) },
        { account: "facebook", status: "published", publishedAt: daysAgo(11), scheduledAt: daysAgo(11) },
      ],
      approval: "approved",
    },
    {
      title: "Weekend inspiration",
      caption: "Slow mornings, bright color. Save this for the weekend. #summer #demobrand",
      format: "feed_post",
      status: "scheduled",
      campaignId: campaignA.id,
      createdAt: daysAgo(4),
      submittedAt: daysAgo(3),
      assetIndexes: [2],
      targets: [
        { account: "instagram", status: "scheduled", scheduledAt: hoursFromNow(20) },
        { account: "facebook", status: "scheduled", scheduledAt: hoursFromNow(20) },
      ],
      approval: "approved",
    },
    {
      title: "New collection teaser",
      caption: "Something new is coming next week. Can you guess the palette? #newcollection",
      format: "feed_post",
      status: "pending_approval",
      campaignId: campaignB.id,
      createdAt: daysAgo(1),
      submittedAt: hoursFromNow(-3),
      assetIndexes: [3],
      targets: [
        { account: "instagram", status: "draft" },
        { account: "facebook", status: "draft" },
      ],
      approval: "pending",
    },
    {
      title: "Community spotlight: Maya",
      caption: "Maya has been styling our pieces all summer. Swipe for her three favorite looks. #community #demobrand",
      format: "carousel",
      status: "revision_required",
      campaignId: campaignB.id,
      createdAt: daysAgo(2),
      submittedAt: daysAgo(1),
      assetIndexes: [4, 5],
      targets: [
        { account: "instagram", status: "draft" },
        { account: "facebook", status: "draft" },
      ],
      approval: "revision_requested",
    },
    {
      title: "Q4 campaign kickoff",
      caption: "Planning has started for our biggest quarter yet. #demobrand",
      format: "feed_post",
      status: "approved",
      campaignId: campaignC.id,
      createdAt: daysAgo(5),
      submittedAt: daysAgo(4),
      assetIndexes: [6],
      targets: [
        { account: "instagram", status: "draft" },
        { account: "facebook", status: "draft" },
      ],
      approval: "approved",
    },
    {
      title: "Story takeover",
      caption: "Our team is taking over stories today. #behindthescenes",
      format: "story",
      status: "queued",
      campaignId: campaignA.id,
      createdAt: daysAgo(1),
      submittedAt: daysAgo(1),
      assetIndexes: [1],
      targets: [
        { account: "instagram", status: "queued", scheduledAt: hoursFromNow(2) },
        { account: "facebook", status: "queued", scheduledAt: hoursFromNow(2) },
      ],
      approval: "approved",
    },
    {
      title: "Failed giveaway",
      caption: "Tag a friend to win the summer bundle. #demobrand",
      format: "feed_post",
      status: "failed",
      campaignId: campaignA.id,
      createdAt: daysAgo(7),
      submittedAt: daysAgo(6),
      assetIndexes: [7],
      targets: [
        { account: "instagram", status: "failed", scheduledAt: daysAgo(5), error: "Instagram media container could not be created: unsupported aspect ratio." },
        { account: "facebook", status: "failed", scheduledAt: daysAgo(5), error: "Facebook Page token was revoked." },
      ],
      approval: "approved",
    },
    {
      title: "Instagram-only drop",
      caption: "A first look only on Instagram. #newcollection",
      format: "feed_post",
      status: "partially_published",
      campaignId: campaignA.id,
      createdAt: daysAgo(9),
      submittedAt: daysAgo(8),
      assetIndexes: [3],
      targets: [
        { account: "instagram", status: "published", publishedAt: daysAgo(7), scheduledAt: daysAgo(7) },
        { account: "facebook", status: "failed", scheduledAt: daysAgo(7), error: "Facebook Page token expired." },
      ],
      approval: "approved",
    },
    {
      title: "October content ideas",
      caption: "Draft notes for October. Not ready for review yet.",
      format: "feed_post",
      status: "draft",
      createdAt: daysAgo(1),
      assetIndexes: [5],
      targets: [{ account: "instagram", status: "draft" }],
    },
    {
      title: "Cancelled flash sale",
      caption: "Flash sale cancelled. #promo",
      format: "feed_post",
      status: "cancelled",
      campaignId: campaignC.id,
      createdAt: daysAgo(20),
      submittedAt: daysAgo(19),
      assetIndexes: [7],
      targets: [
        { account: "instagram", status: "cancelled" },
        { account: "facebook", status: "cancelled" },
      ],
      approval: "approved",
    },
    {
      title: "Publishing now",
      caption: "A live moment from the studio. #behindthescenes",
      format: "feed_post",
      status: "publishing",
      campaignId: campaignA.id,
      createdAt: daysAgo(0),
      submittedAt: daysAgo(0),
      assetIndexes: [1],
      targets: [
        { account: "instagram", status: "publishing", scheduledAt: hoursFromNow(0) },
        { account: "facebook", status: "queued", scheduledAt: hoursFromNow(0) },
      ],
      approval: "approved",
    },
  ];

  const accountByPlatform = { instagram, facebook } as const;
  const createdPosts = [];

  for (const [index, def] of postDefs.entries()) {
    const post = await db.post.create({
      data: {
        workspaceId: workspace.id,
        campaignId: def.campaignId,
        title: def.title,
        baseCaption: def.caption,
        format: def.format,
        status: def.status,
        createdBy: index % 3 === 0 ? admin.id : index % 3 === 1 ? manager.id : executive.id,
        submittedAt: def.submittedAt,
        createdAt: def.createdAt,
      },
    });
    createdPosts.push(post);

    for (const [mediaPosition, assetIndex] of def.assetIndexes.entries()) {
      await db.postMedia.create({
        data: { postId: post.id, mediaAssetId: assets[assetIndex].id, position: mediaPosition },
      });
    }

    for (const hashtag of hashtags.slice(0, 2)) {
      if (def.caption.includes(`#${hashtag.tag}`)) {
        await db.postHashtag.create({ data: { postId: post.id, hashtagId: hashtag.id } });
      }
    }

    for (const [targetIndex, targetDef] of def.targets.entries()) {
      const account = accountByPlatform[targetDef.account];
      const target = await db.postTarget.create({
        data: {
          workspaceId: workspace.id,
          postId: post.id,
          socialAccountId: account.id,
          caption: def.caption,
          scheduledAt: targetDef.scheduledAt,
          publishedAt: targetDef.publishedAt,
          status: targetDef.status,
          lastError: targetDef.error,
          externalPostId: targetDef.publishedAt ? `mock_${targetDef.account}_${post.id.slice(0, 8)}${targetIndex}` : null,
          externalPermalink: targetDef.publishedAt
            ? targetDef.account === "instagram"
              ? `https://www.instagram.com/p/mock_${post.id.slice(0, 8)}`
              : `https://www.facebook.com/102938475610293/posts/mock_${post.id.slice(0, 8)}`
            : null,
        },
      });

      if (targetDef.status === "published" || targetDef.status === "failed") {
        const jobStatus = targetDef.status === "published" ? "succeeded" : "failed";
        const job = await db.publishJob.create({
          data: {
            workspaceId: workspace.id,
            postTargetId: target.id,
            idempotencyKey: `${target.id}:${(targetDef.scheduledAt ?? def.createdAt).toISOString()}`,
            runAt: targetDef.scheduledAt ?? def.createdAt,
            status: jobStatus,
            attempts: targetDef.status === "published" ? 1 : 3,
            completedAt: targetDef.publishedAt ?? targetDef.scheduledAt ?? def.createdAt,
          },
        });
        await db.publishAttempt.create({
          data: {
            jobId: job.id,
            attemptNumber: 1,
            result: targetDef.status === "published" ? "success" : "failure",
            responseCode: targetDef.status === "published" ? 200 : 400,
            errorCode: targetDef.status === "published" ? null : "PROVIDER_ERROR",
            errorMessage: targetDef.error ?? null,
            startedAt: targetDef.scheduledAt ?? def.createdAt,
            finishedAt: targetDef.publishedAt ?? targetDef.scheduledAt ?? def.createdAt,
          },
        });
        if (targetDef.status === "failed") {
          for (let attempt = 2; attempt <= 3; attempt += 1) {
            await db.publishAttempt.create({
              data: {
                jobId: job.id,
                attemptNumber: attempt,
                result: "failure",
                responseCode: 503,
                errorCode: "RETRYABLE",
                errorMessage: targetDef.error ?? "Provider unavailable",
                startedAt: new Date((targetDef.scheduledAt ?? def.createdAt).getTime() + attempt * 60_000),
                finishedAt: new Date((targetDef.scheduledAt ?? def.createdAt).getTime() + attempt * 60_000 + 2_000),
              },
            });
          }
        }
      } else if (targetDef.status === "scheduled" || targetDef.status === "queued") {
        await db.publishJob.create({
          data: {
            workspaceId: workspace.id,
            postTargetId: target.id,
            idempotencyKey: `${target.id}:${(targetDef.scheduledAt ?? hoursFromNow(24)).toISOString()}`,
            runAt: targetDef.scheduledAt ?? hoursFromNow(24),
            status: "waiting",
          },
        });
      }
    }

    if (def.approval) {
      const decision =
        def.approval === "pending"
          ? "pending"
          : def.approval === "approved"
            ? "approved"
            : def.approval === "rejected"
              ? "rejected"
              : "revision_requested";
      await db.postApproval.create({
        data: {
          workspaceId: workspace.id,
          postId: post.id,
          reviewerId: manager.id,
          decision,
          comments:
            decision === "revision_requested"
              ? "Please swap the second image and tighten the caption before resubmitting."
              : decision === "approved"
                ? "Looks good to publish."
                : null,
          requestedAt: def.submittedAt ?? def.createdAt,
          decidedAt: decision === "pending" ? null : (def.submittedAt ?? def.createdAt),
        },
      });
    }
  }

  const publishedTargets = await db.postTarget.findMany({
    where: { workspaceId: workspace.id, status: "published" },
  });

  for (const target of publishedTargets) {
    for (let day = 0; day < 60; day += 1) {
      const metricDate = new Date(Date.UTC(daysAgo(day).getUTCFullYear(), daysAgo(day).getUTCMonth(), daysAgo(day).getUTCDate()));
      const seeded = metrics(day * 17 + target.id.length * 3 + (target.socialAccountId.charCodeAt(0) || 1));
      const decay = 1 + (60 - day) / 90;
      await db.analyticsDaily.create({
        data: {
          workspaceId: workspace.id,
          postTargetId: target.id,
          metricDate,
          impressions: Math.round(seeded.impressions * decay),
          reach: Math.round(seeded.reach * decay),
          likes: Math.round(seeded.likes * decay),
          comments: Math.round(seeded.comments * decay),
          shares: Math.round(seeded.shares * decay),
          saves: Math.round(seeded.saves * decay),
          clicks: Math.round(seeded.clicks * decay),
          videoViews: Math.round(seeded.videoViews * decay),
        },
      });
    }
  }

  for (const [accountIndex, account] of [instagram, facebook].entries()) {
    for (let day = 0; day < 60; day += 1) {
      const base = accountIndex === 0 ? 18420 : 9210;
      const metricDate = new Date(Date.UTC(daysAgo(day).getUTCFullYear(), daysAgo(day).getUTCMonth(), daysAgo(day).getUTCDate()));
      await db.accountMetricsDaily.create({
        data: {
          workspaceId: workspace.id,
          socialAccountId: account.id,
          metricDate,
          followers: base - day * (accountIndex === 0 ? 7 : 3),
          followersGained: 8 + ((day * 3 + accountIndex) % 19),
          followersLost: 2 + ((day + accountIndex) % 5),
          reach: 800 + ((day * 137 + accountIndex * 51) % 2200),
          impressions: 1200 + ((day * 211 + accountIndex * 73) % 3000),
          profileViews: 40 + ((day * 13 + accountIndex) % 90),
          engagementRate: 2.4 + ((day % 30) / 10),
        },
      });
    }
  }

  const postingSlots = [
    { account: instagram, dayOfWeek: 1, slotTime: "09:00" },
    { account: instagram, dayOfWeek: 3, slotTime: "18:30" },
    { account: instagram, dayOfWeek: 5, slotTime: "12:00" },
    { account: facebook, dayOfWeek: 2, slotTime: "10:00" },
    { account: facebook, dayOfWeek: 4, slotTime: "17:00" },
  ];
  for (const slot of postingSlots) {
    await db.postingSlot.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: slot.account.id,
        dayOfWeek: slot.dayOfWeek,
        slotTime: slot.slotTime,
        timezone: "UTC",
        source: "manual",
      },
    });
  }

  const taskDefs = [
    { title: "Approve weekend inspiration", status: "in_review", priority: "high", assignee: manager.id, due: hoursFromNow(6), campaignId: campaignA.id, postId: createdPosts[2].id },
    { title: "Collect UGC for community spotlight", status: "in_progress", priority: "medium", assignee: executive.id, due: daysFromNow(2), campaignId: campaignB.id },
    { title: "Write October content brief", status: "todo", priority: "medium", assignee: executive.id, due: daysFromNow(5) },
    { title: "Reconnect Facebook Page", status: "todo", priority: "urgent", assignee: manager.id, due: hoursFromNow(12) },
    { title: "Review failed giveaway copy", status: "in_progress", priority: "high", assignee: admin.id, due: daysFromNow(1) },
    { title: "Schedule Q4 kickoff", status: "todo", priority: "low", assignee: manager.id, due: daysFromNow(7), campaignId: campaignC.id },
    { title: "Export weekly analytics", status: "done", priority: "low", assignee: admin.id, due: daysAgo(1), completedAt: daysAgo(1) },
    { title: "Update brand hashtag groups", status: "done", priority: "medium", assignee: executive.id, due: daysAgo(3), completedAt: daysAgo(2) },
  ];
  const tasks = [];
  for (const task of taskDefs) {
    tasks.push(
      await db.task.create({
        data: {
          workspaceId: workspace.id,
          campaignId: task.campaignId,
          postId: task.postId,
          title: task.title,
          description: `Demo task: ${task.title}.`,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignee,
          createdBy: admin.id,
          dueAt: task.due,
          completedAt: task.completedAt,
          source: "manual",
        },
      }),
    );
  }
  await db.taskComment.createMany({
    data: [
      { taskId: tasks[0].id, userId: manager.id, body: "Caption is strong. Waiting on the final image crop." },
      { taskId: tasks[0].id, userId: executive.id, body: "Crop updated — ready for another look." },
      { taskId: tasks[1].id, userId: executive.id, body: "Reached out to three creators; two have replied." },
      { taskId: tasks[3].id, userId: manager.id, body: "Token revoked by the Page owner. Asking for reauthorization." },
    ],
  });

  const ruleDefs = [
    { ruleType: "best_time_prediction", name: "Daily best-time prediction", config: { lookbackDays: 60, minGapHours: 2 } },
    { ruleType: "content_gap_detection", name: "14-day content gap scan", config: { horizonDays: 14 } },
    { ruleType: "queue_optimization", name: "Queue optimization", config: { maxMovesPerRun: 5 } },
    { ruleType: "failure_monitoring", name: "Publishing failure monitor", config: { notifyOnFailure: true } },
    { ruleType: "daily_planning", name: "Daily task generation", config: { hourUtc: 8 } },
    { ruleType: "performance_insights", name: "Weekly performance insight", config: { weekday: 1 } },
  ];
  const rules = [];
  for (const [index, rule] of ruleDefs.entries()) {
    rules.push(
      await db.automationRule.create({
        data: {
          workspaceId: workspace.id,
          ruleType: rule.ruleType,
          name: rule.name,
          configuration: json(rule.config),
          enabled: index !== 2,
          createdBy: admin.id,
        },
      }),
    );
  }
  const runs = [];
  for (const [index, rule] of rules.entries()) {
    for (let runIndex = 0; runIndex < 3; runIndex += 1) {
      runs.push(
        await db.automationRun.create({
          data: {
            workspaceId: workspace.id,
            ruleId: rule.id,
            status: index === 2 && runIndex === 0 ? "skipped" : "succeeded",
            result: json({ generated: 1 + ((index + runIndex) % 4) }),
            startedAt: daysAgo(runIndex + 1),
            finishedAt: new Date(daysAgo(runIndex + 1).getTime() + 4_000),
            createdAt: daysAgo(runIndex + 1),
          },
        }),
      );
    }
  }

  const scheduledTarget = await db.postTarget.findFirst({
    where: { workspaceId: workspace.id, status: "scheduled" },
  });

  const recommendationDefs = [
    {
      type: "posting_time",
      payload: { suggestedTime: hoursFromNow(30).toISOString(), reasoning: "Your Instagram audience is 38% more engaged on Thursday evenings.", confidence: 0.87, account: "Demo Brand", platform: "instagram" },
      targetId: scheduledTarget?.id,
      accountId: instagram.id,
    },
    {
      type: "content_gap",
      payload: { date: daysFromNow(5).toISOString(), reasoning: "No content is scheduled for Friday. Your best-performing slot is 12:00 UTC.", confidence: 0.81 },
    },
    {
      type: "queue_change",
      payload: { targetId: scheduledTarget?.id, currentTime: hoursFromNow(20).toISOString(), suggestedTime: hoursFromNow(26).toISOString(), reasoning: "Moving this post avoids a two-hour overlap with the Facebook Page.", confidence: 0.74 },
      targetId: scheduledTarget?.id,
      accountId: instagram.id,
    },
    {
      type: "failure_recovery",
      payload: { postTitle: "Failed giveaway", reasoning: "Two publish attempts failed with a media aspect-ratio error. Replace the asset with a 4:5 image and retry.", confidence: 0.92 },
    },
    {
      type: "insight",
      payload: { headline: "Carousels outperform single images", detail: "Carousel posts average 31% more saves over the last 60 days.", confidence: 0.79 },
    },
  ];
  for (const rec of recommendationDefs) {
    await db.aiRecommendation.create({
      data: {
        workspaceId: workspace.id,
        runId: runs[0]?.id,
        type: rec.type,
        postTargetId: rec.targetId,
        socialAccountId: rec.accountId,
        payload: json(rec.payload),
        status: "suggested",
        expiresAt: daysFromNow(7),
      },
    });
  }

  const discord = await db.discordIntegration.create({
    data: {
      workspaceId: workspace.id,
      discordGuildId: "1187654321098765432",
      guildName: "Demo Brand HQ",
      botStatus: "connected",
      notificationChannelId: "1187654321098765433",
      approvalsChannelId: "1187654321098765434",
      alertsChannelId: "1187654321098765435",
      reportsChannelId: "1187654321098765436",
      notificationSettings: json({ published: true, failed: true, approvalRequired: true, dailySummary: true, weeklyReport: true }),
      commandPermissions: json({ admin: ["dashboard", "posts", "tasks", "publish-status", "schedule", "approve", "analytics"], manager: ["dashboard", "posts", "tasks", "publish-status", "schedule", "approve", "analytics"], executive: ["dashboard", "posts", "tasks", "publish-status"] }),
      connectedBy: admin.id,
      connectedAt: daysAgo(80),
    },
  });
  for (const [index, user] of [admin, manager, executive].entries()) {
    await db.discordUserLink.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        discordUserId: `90000000000000000${index + 1}`,
        discordUsername: ["alice_admin", "bob_manager", "candice_exec"][index],
        verifiedAt: daysAgo(70),
      },
    });
  }
  const commandDefs = [
    { command: "dashboard", status: "executed", userId: admin.id, result: { scheduled: 2, failures: 2 } },
    { command: "approve", status: "executed", userId: manager.id, result: { postId: createdPosts[0].id } },
    { command: "schedule", status: "rejected", userId: executive.id, rejection: "Executive cannot schedule without an approved post." },
    { command: "publish-status", status: "executed", userId: executive.id, result: { failed: 2 } },
    { command: "analytics", status: "executed", userId: admin.id, result: { reach: 18420 } },
    { command: "approve", status: "failed", userId: manager.id, rejection: "Post is no longer pending approval." },
  ];
  for (const [index, command] of commandDefs.entries()) {
    await db.discordCommand.create({
      data: {
        workspaceId: workspace.id,
        integrationId: discord.id,
        userId: command.userId,
        discordUserId: `90000000000000000${[1, 2, 3][index % 3]}`,
        command: command.command,
        arguments: json({ source: "seed" }),
        status: command.status,
        result: command.result ? json(command.result) : null,
        rejectionReason: command.rejection ?? null,
        executedAt: daysAgo(index),
        createdAt: daysAgo(index),
      },
    });
  }

  const notificationDefs = [
    { type: "approval_required", title: "Approval required: New collection teaser", body: "Candice Executive submitted a post for review.", entityType: "post", entityId: createdPosts[3].id, isRead: false, createdAt: hoursFromNow(-3) },
    { type: "publish_failed", title: "Publishing failed: Failed giveaway", body: "Instagram media container could not be created.", entityType: "post", entityId: createdPosts[7].id, isRead: false, createdAt: daysAgo(5) },
    { type: "post_published", title: "Post published: Summer launch hero", body: "Published to Instagram and Facebook.", entityType: "post", entityId: createdPosts[0].id, isRead: true, createdAt: daysAgo(15) },
    { type: "upcoming_post", title: "Upcoming post in 20 hours", body: "Weekend inspiration is scheduled for Instagram and Facebook.", entityType: "post", entityId: createdPosts[2].id, isRead: false, createdAt: hoursFromNow(-1) },
    { type: "token_expiring", title: "Instagram token expires in 5 days", body: "Reconnect Demo Brand to avoid publishing interruptions.", entityType: "social_account", entityId: instagram.id, isRead: false, createdAt: daysAgo(1) },
    { type: "task_assigned", title: "Task assigned: Collect UGC", body: "Bob Manager assigned you a task.", entityType: "task", entityId: tasks[1].id, isRead: false, createdAt: daysAgo(2) },
    { type: "daily_summary", title: "Daily summary", body: "2 posts scheduled, 1 pending approval, 2 failures to review.", entityType: "workspace", entityId: workspace.id, isRead: true, createdAt: daysAgo(1) },
    { type: "approval_decision", title: "Revision requested: Community spotlight", body: "Bob Manager requested changes.", entityType: "post", entityId: createdPosts[4].id, isRead: true, createdAt: daysAgo(1) },
  ];
  for (const notification of notificationDefs) {
    await db.notification.create({
      data: {
        workspaceId: workspace.id,
        userId: notification.isRead ? null : executive.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        entityType: notification.entityType,
        entityId: notification.entityId,
        isRead: notification.isRead,
        readAt: notification.isRead ? daysAgo(0) : null,
        sentAt: notification.createdAt,
        createdAt: notification.createdAt,
      },
    });
  }

  const activityDefs = [
    { action: "workspace.created", entityType: "workspace", entityId: workspace.id, actor: admin.id, days: 100 },
    { action: "member.invited", entityType: "workspace_member", entityId: manager.id, actor: admin.id, days: 95 },
    { action: "account.connected", entityType: "social_account", entityId: instagram.id, actor: admin.id, days: 100 },
    { action: "post.published", entityType: "post", entityId: createdPosts[0].id, actor: null, days: 15 },
    { action: "post.publish_failed", entityType: "post", entityId: createdPosts[7].id, actor: null, days: 5 },
    { action: "post.approved", entityType: "post", entityId: createdPosts[0].id, actor: manager.id, days: 16 },
    { action: "post.revision_requested", entityType: "post", entityId: createdPosts[4].id, actor: manager.id, days: 1 },
    { action: "role.changed", entityType: "workspace_member", entityId: executive.id, actor: admin.id, days: 20 },
    { action: "discord.command_executed", entityType: "discord_command", entityId: null, actor: manager.id, days: 2 },
    { action: "automation.rule_run", entityType: "automation_rule", entityId: rules[0].id, actor: null, days: 1 },
    { action: "report.generated", entityType: "report", entityId: null, actor: admin.id, days: 7 },
    { action: "account.token_expiring", entityType: "social_account", entityId: instagram.id, actor: null, days: 1 },
  ];
  for (const activity of activityDefs) {
    await db.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: activity.actor,
        actorType: activity.actor ? "user" : "system",
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId,
        metadata: json({ source: "seed" }),
        createdAt: daysAgo(activity.days),
      },
    });
  }

  const reportData = {
    summary: { impressions: 184200, reach: 132000, engagementRate: 4.1, followersGained: 842 },
    topPosts: [
      { title: "Summer launch hero", impressions: 28400, likes: 2100 },
      { title: "Behind the scenes reel", impressions: 22100, likes: 1800 },
      { title: "Instagram-only drop", impressions: 18400, likes: 1300 },
    ],
  };
  await db.report.create({
    data: {
      workspaceId: workspace.id,
      type: "weekly",
      periodStart: daysAgo(7),
      periodEnd: daysAgo(0),
      data: json(reportData),
      generatedBy: "system",
      createdAt: daysAgo(1),
    },
  });
  await db.report.create({
    data: {
      workspaceId: workspace.id,
      type: "daily",
      periodStart: daysAgo(1),
      periodEnd: daysAgo(0),
      data: json({ summary: { impressions: 8400, reach: 6100, engagementRate: 3.8 } }),
      generatedBy: "system",
      createdAt: daysAgo(0),
    },
  });

  await db.emailOutbox.create({
    data: {
      to: "admin@socialflow.test",
      subject: "Welcome to SocialFlow",
      body: "Your demo workspace is ready.",
      link: `${process.env.APP_URL ?? "http://localhost:3000"}/login`,
    },
  });

  console.log("\nSocialFlow seed complete.");
  console.log("Workspace: Demo Brand (/w/demo-brand)");
  console.log("Users:");
  console.log("  admin@socialflow.test / Password123!  (Admin)");
  console.log("  manager@socialflow.test / Password123! (Manager)");
  console.log("  exec@socialflow.test / Password123!   (Executive)");
  console.log(`Posts: ${createdPosts.length}, media: ${assets.length}, tasks: ${tasks.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
