"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/auth";
import { encryptSecret, randomToken, sha256 } from "@/lib/crypto";
import { sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import { canInviteRole, DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS, normalizeRole, type Role } from "@/lib/permissions";
import { parseJson, slugify } from "@/lib/utils";
import type { ActionState } from "./types";

async function currentUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

async function adminMembership(userId: string) {
  return db.workspaceMember.findFirst({
    where: { userId, role: "admin", status: "active", workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
}

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is required.").max(150),
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required.")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
  timezone: z.string().min(1, "Choose a timezone."),
});

export async function createWorkspaceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user.emailVerifiedAt) return { error: "Verify your email before creating a workspace." };

  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const { name, slug, timezone } = parsed.data;
  const existingSlug = await db.workspace.findUnique({ where: { slug } });
  if (existingSlug) {
    const base = slugify(name) || "workspace";
    let suggestion = `${base}-2`;
    let index = 2;
    while (await db.workspace.findUnique({ where: { slug: suggestion } })) suggestion = `${base}-${index++}`;
    return { error: "That slug is already taken.", fieldErrors: { slug: `Try ${suggestion}` } };
  }

  await db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name,
        slug,
        defaultTimezone: timezone,
        ownerId: user.id,
        onboardingStep: 2,
      },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "admin" },
    });
    await tx.rolePermission.createMany({
      data: (Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[]).flatMap((role) =>
        ALL_PERMISSIONS.map((permission) => ({
          workspaceId: workspace.id,
          role,
          permission,
          allowed: DEFAULT_ROLE_PERMISSIONS[role].includes(permission),
        })),
      ),
    });
    await tx.activityLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "workspace.created",
        entityType: "workspace",
        entityId: workspace.id,
        metadata: JSON.stringify({ name, slug }),
      },
    });
  });

  redirect("/onboarding/2");
}

export async function inviteOnboardingMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const membership = await adminMembership(user.id);
  if (!membership) return { error: "Only an Admin can invite team members during onboarding." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = normalizeRole(String(formData.get("role") ?? "executive"));
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  }
  if (!canInviteRole("admin", role)) return { error: "You cannot invite that role." };

  const existingMember = await db.workspaceMember.findFirst({
    where: { workspaceId: membership.workspaceId, user: { email } },
  });
  if (existingMember) return { error: "That person is already a member.", fieldErrors: { email: "Already a member." } };
  const pending = await db.invitation.findFirst({
    where: { workspaceId: membership.workspaceId, email, status: "pending" },
  });
  if (pending) return { error: "An invitation is already pending.", fieldErrors: { email: "Pending invitation exists." } };

  const token = randomToken(32);
  const invitation = await db.invitation.create({
    data: {
      workspaceId: membership.workspaceId,
      email,
      role,
      tokenHash: sha256(token),
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const link = `${env.APP_URL}/invite/${token}`;
  await sendMail({
    to: email,
    subject: `You're invited to ${membership.workspace.name} on SocialFlow`,
    body: `Join ${membership.workspace.name} as ${role}. This invitation expires in 7 days.`,
    link,
  });
  await logActivity({
    workspaceId: membership.workspaceId,
    actorUserId: user.id,
    action: "invitation.created",
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { email, role },
  });
  return { ok: true, message: `Invitation sent to ${email}.`, devLink: link };
}

export async function advanceOnboardingAction(formData: FormData) {
  const user = await currentUser();
  const membership = await adminMembership(user.id);
  if (!membership) redirect("/onboarding/1");
  const step = Number(formData.get("step") ?? membership.workspace.onboardingStep);
  const next = Math.min(Math.max(step, 1), 5);
  await db.workspace.update({
    where: { id: membership.workspaceId },
    data: { onboardingStep: next },
  });
  redirect(`/onboarding/${next}`);
}

export async function connectSocialAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const membership = await adminMembership(user.id);
  if (!membership) return { error: "Only an Admin can connect accounts during onboarding." };
  const platform = String(formData.get("platform") ?? "");
  if (platform !== "instagram" && platform !== "facebook") return { error: "Choose Instagram or Facebook." };

  const platformAccountId = `${platform === "instagram" ? "178414" : "102938"}${Math.floor(Math.random() * 900000000 + 100000000)}`;
  const existing = await db.socialAccount.findUnique({
    where: { platform_platformAccountId: { platform, platformAccountId } },
  });
  if (existing) return { error: "This account is already connected to a workspace." };

  const account = await db.socialAccount.create({
    data: {
      workspaceId: membership.workspaceId,
      platform,
      platformAccountId,
      accountName: platform === "instagram" ? "Demo Instagram" : "Demo Facebook Page",
      username: platform === "instagram" ? "@demo.instagram" : "@demo.facebook",
      profilePictureUrl: "/uploads/seed-1.svg",
      connectedBy: user.id,
      metadata: JSON.stringify({ followers: 0, mockFailNext: false }),
    },
  });
  await db.socialCredential.create({
    data: {
      socialAccountId: account.id,
      accessTokenEncrypted: encryptSecret(`mock-${platform}-access-token-${randomToken(8)}`),
      refreshTokenEncrypted: encryptSecret(`mock-${platform}-refresh-token`),
      encryptionKeyId: "local-dev-key",
      scopes: JSON.stringify(platform === "instagram" ? ["instagram_basic", "instagram_content_publish"] : ["pages_manage_posts"]),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });
  await db.workspace.update({
    where: { id: membership.workspaceId },
    data: { onboardingStep: 4, settings: JSON.stringify(withoutSkippedStep(membership.workspace.settings, 3)) },
  });
  await logActivity({
    workspaceId: membership.workspaceId,
    actorUserId: user.id,
    action: "account.connected",
    entityType: "social_account",
    entityId: account.id,
    metadata: { platform, mode: "mock" },
  });
  return { ok: true, message: `${platform === "instagram" ? "Instagram" : "Facebook"} connected.` };
}

export async function connectDiscordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await currentUser();
  const membership = await adminMembership(user.id);
  if (!membership) return { error: "Only an Admin can configure Discord." };
  const guildName = String(formData.get("guildName") ?? "Demo Brand HQ").trim();
  const guildId = `1187${Math.floor(Math.random() * 900000000000 + 100000000000)}`;
  const existing = await db.discordIntegration.findUnique({ where: { workspaceId: membership.workspaceId } });
  const integration = existing
    ? await db.discordIntegration.update({
        where: { id: existing.id },
        data: { guildName, discordGuildId: existing.discordGuildId || guildId, botStatus: "connected", disconnectedAt: null },
      })
    : await db.discordIntegration.create({
        data: {
          workspaceId: membership.workspaceId,
          discordGuildId: guildId,
          guildName,
          botStatus: "connected",
          notificationChannelId: "1187654321098765433",
          approvalsChannelId: "1187654321098765434",
          alertsChannelId: "1187654321098765435",
          reportsChannelId: "1187654321098765436",
          notificationSettings: JSON.stringify({ published: true, failed: true, approvalRequired: true }),
          commandPermissions: JSON.stringify({ admin: ["dashboard", "approve"], manager: ["dashboard", "approve"], executive: ["dashboard"] }),
          connectedBy: user.id,
        },
      });
  await db.discordUserLink.upsert({
    where: { workspaceId_userId: { workspaceId: membership.workspaceId, userId: user.id } },
    create: {
      workspaceId: membership.workspaceId,
      userId: user.id,
      discordUserId: `9000${Math.floor(Math.random() * 900000000000 + 100000000000)}`,
      discordUsername: user.fullName.toLowerCase().replace(/\s+/g, "_"),
      verifiedAt: new Date(),
    },
    update: { verifiedAt: new Date() },
  });
  await db.workspace.update({
    where: { id: membership.workspaceId },
    data: { onboardingStep: 5, settings: JSON.stringify(withoutSkippedStep(membership.workspace.settings, 4)) },
  });
  await logActivity({
    workspaceId: membership.workspaceId,
    actorUserId: user.id,
    action: "discord.connected",
    entityType: "discord_integration",
    entityId: integration.id,
    metadata: { guildName, mode: "mock" },
  });
  return { ok: true, message: "Discord connected and your user account linked." };
}

export async function completeOnboardingAction(formData: FormData) {
  const user = await currentUser();
  const membership = await adminMembership(user.id);
  if (!membership) redirect("/onboarding/1");
  await db.workspace.update({
    where: { id: membership.workspaceId },
    data: { onboardingStep: 5, onboardingCompletedAt: new Date() },
  });
  await logActivity({
    workspaceId: membership.workspaceId,
    actorUserId: user.id,
    action: "onboarding.completed",
    entityType: "workspace",
    entityId: membership.workspaceId,
  });
  redirect(`/w/${membership.workspace.slug}/dashboard?onboarded=1`);
}

export async function skipOnboardingStepAction(formData: FormData) {
  const user = await currentUser();
  const membership = await adminMembership(user.id);
  if (!membership) redirect("/onboarding/1");
  const requestedNext = Number(formData.get("next") ?? 3);
  const next = Number.isInteger(requestedNext) ? Math.min(Math.max(requestedNext, 1), 5) : 3;
  const skippedStep = next - 1;
  const settings = parseJson<Record<string, unknown>>(membership.workspace.settings, {});
  const skippedSteps = new Set<number>(Array.isArray(settings.onboardingSkippedSteps)
    ? settings.onboardingSkippedSteps.filter((value): value is number => Number.isInteger(value))
    : []);
  if (skippedStep === 3 || skippedStep === 4) skippedSteps.add(skippedStep);
  await db.workspace.update({
    where: { id: membership.workspaceId },
    data: {
      onboardingStep: Math.min(Math.max(next, 1), 5),
      settings: JSON.stringify({ ...settings, onboardingSkippedSteps: [...skippedSteps] }),
    },
  });
  redirect(`/onboarding/${next}`);
}

function withoutSkippedStep(serialized: string, step: number) {
  const settings = parseJson<Record<string, unknown>>(serialized, {});
  const skipped = Array.isArray(settings.onboardingSkippedSteps)
    ? settings.onboardingSkippedSteps.filter((value) => value !== step)
    : [];
  return JSON.stringify({ ...settings, onboardingSkippedSteps: skipped });
}
