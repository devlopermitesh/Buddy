import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireUser, getUserWorkspaces } from "@/lib/auth";
import { switchWorkspaceAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, normalizeRole } from "@/lib/permissions";

export default async function SelectWorkspacePage() {
  const user = await requireUser("/select-workspace");
  const memberships = await getUserWorkspaces(user.id);
  if (memberships.length === 0) redirect("/onboarding/1");
  if (memberships.length === 1) redirect(`/w/${memberships[0].workspace.slug}/dashboard`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a workspace</h1>
          <p className="text-sm text-muted-foreground">You belong to more than one workspace.</p>
        </div>
        <div className="space-y-2">
          {memberships.map((membership) => (
            <form key={membership.id} action={switchWorkspaceAction}>
              <input type="hidden" name="workspaceId" value={membership.workspace.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-muted"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{membership.workspace.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABELS[normalizeRole(membership.role)]}
                    </span>
                  </span>
                </span>
                <span className="text-sm text-primary">Open →</span>
              </button>
            </form>
          ))}
        </div>
        <div className="text-center">
          <Button asChild variant="ghost">
            <Link href="/onboarding/1">Create another workspace</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
