import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import type { User, Workspace, WorkspaceMember } from "@prisma/client";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { can, normalizeRole, type Permission, type Role } from "./permissions";
import { parseJson } from "./utils";

const SESSION_COOKIE = "sf_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 2 });
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.userSession.create({
    data: {
      userId,
      refreshTokenHash: sha256(token),
      expiresAt,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.userSession.updateMany({
      where: { refreshTokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.userSession.findUnique({
    where: { refreshTokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
  if (!session.user.isActive) return null;
  return session.user;
});

export async function requireUser(nextPath?: string) {
  const user = await getSessionUser();
  if (!user) {
    // Distinguish "never signed in" from "session expired" so the user gets
    // the right recovery page and can continue where they left off.
    const cookieStore = await cookies();
    const hadSession = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`${hadSession ? "/session-expired" : "/login"}${suffix}`);
  }
  return user;
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId, status: "active", workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  return memberships;
}

export async function resolvePostLoginPath(userId: string) {
  const memberships = await getUserWorkspaces(userId);
  if (memberships.length === 0) return "/onboarding/1";
  const adminMembership = memberships.find((m) => m.role === "admin");
  if (adminMembership && !adminMembership.workspace.onboardingCompletedAt) {
    const step = Math.min(Math.max(adminMembership.workspace.onboardingStep, 1), 5);
    return `/onboarding/${step}`;
  }
  if (memberships.length > 1) return "/select-workspace";
  return `/w/${memberships[0].workspace.slug}/dashboard`;
}

export type WorkspaceContext = {
  user: User;
  workspace: Workspace;
  member: WorkspaceMember;
  role: Role;
  permissions: { permission: string; allowed: boolean }[];
  can: (permission: Permission) => boolean;
};

export async function getWorkspaceContext(slug: string, permission?: Permission): Promise<WorkspaceContext> {
  const user = await getSessionUser();
  if (!user) {
    const cookieStore = await cookies();
    const hadSession = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
    const next = encodeURIComponent(`/w/${slug}/dashboard`);
    redirect(`${hadSession ? "/session-expired" : "/login"}?next=${next}`);
  }

  const workspace = await db.workspace.findFirst({ where: { slug, deletedAt: null } });
  if (!workspace) notFound();

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });
  if (!member || member.status !== "active") redirect("/403");

  const role = normalizeRole(member.role);
  const stored = await db.rolePermission.findMany({
    where: { workspaceId: workspace.id, role },
    select: { permission: true, allowed: true },
  });
  const overrides = parseJson<Record<string, boolean>>(member.permissionOverrides, {});
  const canFn = (key: Permission) => can(role, key, overrides, stored);

  if (permission && !canFn(permission)) redirect("/403");

  return { user, workspace, member, role, permissions: stored, can: canFn };
}

export async function getWorkspaceById(workspaceId: string) {
  return db.workspace.findFirst({ where: { id: workspaceId, deletedAt: null } });
}

export async function getMemberForWorkspace(workspaceId: string, userId: string) {
  return db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export function memberCan(
  role: string,
  overrides: string | null,
  stored: { permission: string; allowed: boolean }[],
  permission: Permission,
) {
  return can(normalizeRole(role), permission, parseJson<Record<string, boolean>>(overrides, {}), stored);
}
