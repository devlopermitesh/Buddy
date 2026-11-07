import { PERMISSIONS, type Permission } from "./permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  permission?: Permission;
  exact?: boolean;
  /**
   * Executives get a limited view of this page even though they do not hold
   * the underlying permission. The page itself narrows the data it shows.
   */
  executiveView?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

// Sidebar groups mirror Board 1 exactly: OVERVIEW, CONTENT, AUTOMATION,
// PLANNING, INSIGHTS and WORKSPACE. Pages the role cannot use are hidden here
// and enforced again on the server.
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard", exact: true },
      { label: "Notifications", href: "/notifications", icon: "bell" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Content Studio", href: "/content-studio", icon: "pen", permission: PERMISSIONS.POSTS_CREATE },
      { label: "Media Library", href: "/media", icon: "image", permission: PERMISSIONS.MEDIA_MANAGE },
      { label: "Content Calendar", href: "/calendar", icon: "calendar" },
      { label: "Publishing Queue", href: "/queue", icon: "queue", permission: PERMISSIONS.POSTS_SCHEDULE },
      {
        label: "Approval Center",
        href: "/approvals",
        icon: "approvals",
        permission: PERMISSIONS.POSTS_APPROVE,
        executiveView: true,
      },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "AI Smart Scheduling", href: "/ai-scheduling", icon: "sparkles", permission: PERMISSIONS.AI_SCHEDULE },
      { label: "Automation Center", href: "/automation", icon: "bot", permission: PERMISSIONS.AUTOMATION_MANAGE },
    ],
  },
  {
    label: "Planning",
    items: [
      { label: "Tasks", href: "/tasks", icon: "tasks", permission: PERMISSIONS.TASKS_MANAGE },
      { label: "Campaigns", href: "/campaigns", icon: "megaphone", permission: PERMISSIONS.CAMPAIGNS_MANAGE },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: "chart", permission: PERMISSIONS.ANALYTICS_VIEW },
      { label: "Reports", href: "/reports", icon: "report", permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Team Management", href: "/team", icon: "team", permission: PERMISSIONS.MEMBERS_VIEW },
      { label: "Connected Accounts", href: "/accounts", icon: "link", permission: PERMISSIONS.ACCOUNTS_CONNECT },
      { label: "Discord Integration", href: "/discord", icon: "discord", permission: PERMISSIONS.DISCORD_VIEW },
      { label: "Settings", href: "/settings", icon: "settings", permission: PERMISSIONS.SETTINGS_PROFILE },
      { label: "Audit Logs", href: "/activity-logs", icon: "history", permission: PERMISSIONS.AUDITLOGS_VIEW },
    ],
  },
];

export function isNavItemActive(pathname: string, base: string, href: string, exact?: boolean) {
  const full = `${base}${href}`;
  if (exact) return pathname === full;
  return pathname === full || pathname.startsWith(`${full}/`);
}

export function visibleNavSections(allowed: string[], role: string): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !item.permission ||
        allowed.includes(item.permission) ||
        (role === "executive" && item.executiveView),
    ),
  })).filter((section) => section.items.length > 0);
}
