"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword, createSession, destroySession, resolvePostLoginPath, getSessionUser } from "@/lib/auth";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";
import { slugify } from "@/lib/utils";
import type { ActionState } from "./types";

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[0-9]/, "Add a number.");

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(150),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1",
    userAgent: h.get("user-agent") ?? "unknown",
  };
}

function safeNext(value: FormDataEntryValue | null): string | null {
  const next = String(value ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

async function issueVerification(userId: string, email: string, fullName: string, next?: string | null) {
  const token = randomToken(32);
  await db.authToken.create({
    data: {
      userId,
      type: "email_verification",
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const suffix = next ? `&next=${encodeURIComponent(next)}` : "";
  const link = `${env.APP_URL}/verify-email?token=${token}${suffix}`;
  await sendMail({
    to: email,
    subject: "Verify your SocialFlow email",
    body: `Hi ${fullName}, confirm your email address to finish creating your SocialFlow account. This link expires in 24 hours.`,
    link,
  });
  return link;
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const { fullName, email, password } = parsed.data;
  const next = safeNext(formData.get("next"));
  const meta = await requestMeta();
  const limit = rateLimit(`signup:${meta.ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) return { error: "Too many attempts. Please try again in a few minutes." };

  // When signup was opened from an invitation link, the email is locked to the
  // address on the invitation. Enforce that server-side, not just in the form.
  if (next?.startsWith("/invite/")) {
    const token = next.slice("/invite/".length).split("?")[0];
    const invitation = token
      ? await db.invitation.findUnique({ where: { tokenHash: sha256(token) } })
      : null;
    if (!invitation || invitation.status !== "pending" || invitation.expiresAt.getTime() < Date.now()) {
      return { error: "This invitation is no longer valid. Ask an Admin to resend it." };
    }
    if (invitation.email.toLowerCase() !== email) {
      return {
        error: `This invitation was sent to ${invitation.email}. Use that email address to accept it.`,
        fieldErrors: { email: `Use ${invitation.email}.` },
      };
    }
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "An account with this email already exists.",
      fieldErrors: { email: "Sign in instead, or reset your password." },
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { email, fullName, passwordHash },
  });
  await issueVerification(user.id, email, fullName, next);
  await logActivity({
    workspaceId: "system",
    actorUserId: user.id,
    action: "auth.signup",
    entityType: "user",
    entityId: user.id,
  }).catch(() => undefined);

  const query = new URLSearchParams({ email, sent: "1" });
  if (next) query.set("next", next);
  redirect(`/verify-email?${query.toString()}`);
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { error: "Enter your email and password." };

  const meta = await requestMeta();
  const ipLimit = rateLimit(`login-ip:${meta.ip}`, 100, 15 * 60 * 1000);
  const accountLimit = rateLimit(`login:${email}`, 20, 15 * 60 * 1000);
  if (!ipLimit.allowed || !accountLimit.allowed) return { error: "Too many attempts. Please wait a few minutes." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return { error: "Invalid email or password." };
  }
  if (!user.isActive) return { error: "This account is disabled. Contact your workspace Admin." };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return { error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    // Once a temporary lockout has elapsed the counter starts fresh again.
    const previousFailures = user.lockedUntil && user.lockedUntil.getTime() <= Date.now() ? 0 : user.failedLoginCount;
    const failedLoginCount = previousFailures + 1;
    const lockedUntil = failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount, lockedUntil },
    });
    if (lockedUntil) {
      await logActivity({
        workspaceId: "system",
        actorUserId: user.id,
        action: "auth.account_locked",
        entityType: "user",
        entityId: user.id,
        metadata: { failedLoginCount },
      }).catch(() => undefined);
      return { error: "Too many failed attempts. This account is locked for 15 minutes." };
    }
    return { error: "Invalid email or password." };
  }

  if (!user.emailVerifiedAt) {
    const query = new URLSearchParams({ email, unverified: "1" });
    if (next) query.set("next", next);
    redirect(`/verify-email?${query.toString()}`);
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, meta);

  if (next) redirect(next);
  redirect(await resolvePostLoginPath(user.id));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function logoutToLoginAction(formData: FormData) {
  const next = safeNext(formData.get("next"));
  await destroySession();
  redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!token) return { error: "Verification token is missing." };
  const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!record || record.type !== "email_verification") {
    return { error: "This verification link is invalid. Request a new one." };
  }
  if (record.usedAt) return { error: "This verification link has already been used." };
  if (record.expiresAt.getTime() < Date.now()) {
    return { error: "This verification link has expired. Request a new one." };
  }
  await db.$transaction([
    db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  const meta = await requestMeta();
  await createSession(record.userId, meta);
  // If signup started from an invite, continue acceptance instead of routing
  // the brand-new user into workspace onboarding.
  if (next) redirect(next);
  redirect(await resolvePostLoginPath(record.userId));
}

export async function resendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(formData.get("next"));
  const limit = rateLimit(`resend-verify:${email}`, 3, 10 * 60 * 1000);
  if (!limit.allowed) return { error: "A verification email was sent recently. Please wait before retrying." };
  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt) {
    await issueVerification(user.id, user.email, user.fullName, next);
  }
  return { ok: true, message: "If that account needs verification, a new link has been sent." };
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };
  const limit = rateLimit(`forgot:${email}`, 3, 15 * 60 * 1000);
  if (!limit.allowed) return { ok: true, message: "If an account exists, a reset link has been sent." };

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = randomToken(32);
    await db.authToken.create({
      data: {
        userId: user.id,
        type: "password_reset",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendMail({
      to: user.email,
      subject: "Reset your SocialFlow password",
      body: "Use the link below to choose a new password. The link expires in one hour and can only be used once.",
      link: `${env.APP_URL}/reset-password?token=${token}`,
    });
  }
  return { ok: true, message: "If an account exists, a reset link has been sent." };
}

const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== "password_reset") return { error: "This reset link is invalid." };
  if (record.usedAt) return { error: "This reset link has already been used." };
  if (record.expiresAt.getTime() < Date.now()) return { error: "This reset link has expired. Request a new one." };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
    db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.userSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  redirect("/login?reset=1");
}

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const invitation = await db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { workspace: true },
  });
  if (!invitation) return { error: "This invitation is invalid." };
  if (invitation.status !== "pending") return { error: "This invitation is no longer pending." };
  if (invitation.expiresAt.getTime() < Date.now()) return { error: "This invitation has expired. Ask an Admin to resend it." };
  if (invitation.workspace.deletedAt) return { error: "This workspace is unavailable." };
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      error: `This invitation was sent to ${invitation.email}. Switch accounts to accept it.`,
    };
  }

  const existingMember = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
  });

  await db.$transaction(async (tx) => {
    if (!existingMember) {
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        },
      });
    }
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    await tx.activityLog.create({
      data: {
        workspaceId: invitation.workspaceId,
        actorUserId: user.id,
        actorType: "user",
        action: "invitation.accepted",
        entityType: "invitation",
        entityId: invitation.id,
        metadata: JSON.stringify({ role: invitation.role }),
      },
    });
  });

  redirect(`/w/${invitation.workspace.slug}/dashboard`);
}

export async function switchWorkspaceAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    include: { workspace: true },
  });
  if (!membership || membership.status !== "active") redirect("/403");
  redirect(`/w/${membership.workspace.slug}/dashboard`);
}

export async function suggestSlugAction(name: string) {
  const base = slugify(name) || "workspace";
  let candidate = base;
  let index = 1;
  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${index++}`;
  }
  return candidate;
}
