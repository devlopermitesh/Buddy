import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspaceContext, getUserWorkspaces } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);

  if (!ctx.workspace.onboardingCompletedAt && ctx.role === "admin") {
    const step = Math.min(Math.max(ctx.workspace.onboardingStep, 1), 5);
    redirect(`/onboarding/${step}`);
  }

  const allowed = ALL_PERMISSIONS.filter((permission) => ctx.can(permission));
  const [memberships, unreadCount] = await Promise.all([
    getUserWorkspaces(ctx.user.id),
    db.notification.count({
      where: {
        workspaceId: ctx.workspace.id,
        isRead: false,
        OR: [{ userId: ctx.user.id }, { userId: null }],
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        slug={slug}
        allowed={allowed}
        workspaceName={ctx.workspace.name}
        role={ctx.role}
        logoUrl={ctx.workspace.logoUrl}
      />
      <div className="lg:pl-64">
        <Topbar
          slug={slug}
          user={{ fullName: ctx.user.fullName, email: ctx.user.email, avatarUrl: ctx.user.avatarUrl }}
          memberships={memberships.map((membership) => ({
            id: membership.workspace.id,
            name: membership.workspace.name,
            slug: membership.workspace.slug,
          }))}
          unreadCount={unreadCount}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
