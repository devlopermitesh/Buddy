import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/onboarding/1");
  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id, role: "admin", status: "active", workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  if (membership?.workspace.onboardingCompletedAt) {
    redirect(`/w/${membership.workspace.slug}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link href="/onboarding/1" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">SF</span>
            SocialFlow
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">{user.email}</span>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:py-12">{children}</main>
    </div>
  );
}
