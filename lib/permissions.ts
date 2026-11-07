export const ROLES = ["admin", "manager", "executive"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  WORKSPACE_MANAGE: "workspace.manage",
  WORKSPACE_SETTINGS: "workspace.settings",
  MEMBERS_VIEW: "members.view",
  MEMBERS_INVITE: "members.invite",
  MEMBERS_MANAGE: "members.manage",
  ROLES_MANAGE: "roles.manage",
  ACCOUNTS_CONNECT: "accounts.connect",
  ACCOUNTS_MANAGE: "accounts.manage",
  POSTS_CREATE: "posts.create",
  POSTS_SCHEDULE: "posts.schedule",
  POSTS_APPROVE: "posts.approve",
  POSTS_PUBLISH: "posts.publish",
  CAMPAIGNS_MANAGE: "campaigns.manage",
  AUTOMATION_MANAGE: "automation.manage",
  ANALYTICS_VIEW: "analytics.view",
  REPORTS_VIEW: "reports.view",
  TASKS_MANAGE: "tasks.manage",
  DISCORD_CONFIGURE: "discord.configure",
  DISCORD_VIEW: "discord.view",
  AUDITLOGS_VIEW: "auditlogs.view",
  SETTINGS_PROFILE: "settings.profile",
  AI_SCHEDULE: "ai.schedule",
  MEDIA_MANAGE: "media.manage",
  NOTIFICATIONS_MANAGE: "notifications.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  manager: [
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.ACCOUNTS_CONNECT,
    PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_SCHEDULE,
    PERMISSIONS.POSTS_APPROVE,
    PERMISSIONS.POSTS_PUBLISH,
    PERMISSIONS.CAMPAIGNS_MANAGE,
    PERMISSIONS.AUTOMATION_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.TASKS_MANAGE,
    PERMISSIONS.DISCORD_VIEW,
    PERMISSIONS.SETTINGS_PROFILE,
    PERMISSIONS.AI_SCHEDULE,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.NOTIFICATIONS_MANAGE,
  ],
  executive: [
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_SCHEDULE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.TASKS_MANAGE,
    PERMISSIONS.DISCORD_VIEW,
    PERMISSIONS.SETTINGS_PROFILE,
    PERMISSIONS.AI_SCHEDULE,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.NOTIFICATIONS_MANAGE,
  ],
};

export function isRole(value: string | null | undefined): value is Role {
  return value === "admin" || value === "manager" || value === "executive";
}

export function normalizeRole(value: string | null | undefined): Role {
  return isRole(value) ? value : "executive";
}

export function can(
  role: Role,
  permission: Permission,
  overrides: Record<string, boolean> = {},
  stored: { permission: string; allowed: boolean }[] = [],
): boolean {
  if (typeof overrides[permission] === "boolean") return overrides[permission];
  const row = stored.find((entry) => entry.permission === permission);
  if (row) return row.allowed;
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
}

export function canInviteRole(inviterRole: Role, targetRole: Role): boolean {
  if (inviterRole === "admin") return true;
  if (inviterRole === "manager") return targetRole === "manager" || targetRole === "executive";
  return false;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  executive: "Executive",
};
