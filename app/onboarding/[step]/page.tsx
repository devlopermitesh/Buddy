import { redirect } from "next/navigation";
import { CheckCircle2, Rocket } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { advanceOnboardingAction, completeOnboardingAction, skipOnboardingStepAction } from "@/lib/actions/onboarding";
import { ROLE_LABELS } from "@/lib/permissions";
import { parseJson } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceStepForm, InviteStepForm, SocialStepForm, DiscordStepForm } from "@/components/onboarding/onboarding-forms";

const STEPS = [
  { step: 1, label: "Workspace" },
  { step: 2, label: "Team" },
  { step: 3, label: "Social accounts" },
  { step: 4, label: "Discord" },
  { step: 5, label: "Ready" },
];

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: rawStep } = await params;
  const step = Number(rawStep);
  if (!Number.isInteger(step) || step < 1 || step > 5) redirect("/onboarding/1");
  const user = await requireUser(`/onboarding/${step}`);

  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id, role: "admin", status: "active", workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  if (step > 1 && !membership) redirect("/onboarding/1");
  if (membership?.workspace.onboardingCompletedAt) redirect(`/w/${membership.workspace.slug}/dashboard`);

  const workspace = membership?.workspace;
  const [accounts, invitations, discordIntegration] = membership
    ? await Promise.all([
        db.socialAccount.findMany({ where: { workspaceId: workspace!.id }, orderBy: { connectedAt: "asc" } }),
        db.invitation.findMany({ where: { workspaceId: workspace!.id }, include: { inviter: true }, orderBy: { createdAt: "desc" } }),
        db.discordIntegration.findUnique({ where: { workspaceId: workspace!.id } }),
      ])
    : [[], [], null];
  const settings = workspace ? parseJson<{ onboardingSkippedSteps?: number[] }>(workspace.settings, {}) : {};
  const skipped = new Set(settings.onboardingSkippedSteps ?? []);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STEPS.map((item) => (
            <span
              key={item.step}
              className={
                item.step === step
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : item.step < step
                    ? "rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                    : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {item.step}. {item.label}
            </span>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step {step} of 5</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {step === 1 && "Set up your workspace"}
            {step === 2 && "Invite your team"}
            {step === 3 && "Connect social accounts"}
            {step === 4 && "Connect Discord"}
            {step === 5 && "You're ready to go"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1 && "This is where your content, campaigns and reports will live."}
            {step === 2 && "Give people the right level of access from the start."}
            {step === 3 && "Mock OAuth is enabled locally, so no real Meta app is needed."}
            {step === 4 && "Optional: get approvals and publishing updates in Discord."}
            {step === 5 && "Your workspace is configured. Jump in whenever you're ready."}
          </p>
        </div>
      </div>

      {step === 1 ? <WorkspaceStepForm defaultName={`${user.fullName.split(" ")[0]}'s Workspace`} /> : null}

      {step === 2 && workspace ? (
        <div className="space-y-4">
          <InviteStepForm />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team so far</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{user.fullName} (you)</span>
                <Badge variant="success">Admin</Badge>
              </div>
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="min-w-0 truncate">{invitation.email}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{ROLE_LABELS[invitation.role as keyof typeof ROLE_LABELS] ?? invitation.role}</Badge>
                    <Badge variant={invitation.status === "pending" ? "warning" : "neutral"}>{invitation.status}</Badge>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <form action={skipOnboardingStepAction}>
              <input type="hidden" name="next" value="3" />
              <Button variant="ghost" type="submit">
                Skip for now
              </Button>
            </form>
            <form action={advanceOnboardingAction}>
              <input type="hidden" name="step" value="3" />
              <Button type="submit">Continue</Button>
            </form>
          </div>
        </div>
      ) : null}

      {step === 3 && workspace ? (
        <div className="space-y-4">
          <SocialStepForm accounts={accounts.map((account) => ({ id: account.id, platform: account.platform, accountName: account.accountName, status: account.status }))} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <form action={skipOnboardingStepAction}>
              <input type="hidden" name="next" value="4" />
              <Button variant="ghost" type="submit">
                Skip for now
              </Button>
            </form>
            <form action={advanceOnboardingAction}>
              <input type="hidden" name="step" value="4" />
              <Button type="submit">Continue</Button>
            </form>
          </div>
        </div>
      ) : null}

      {step === 4 && workspace ? (
        <div className="space-y-4">
          <DiscordStepForm />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <form action={skipOnboardingStepAction}>
              <input type="hidden" name="next" value="5" />
              <Button variant="ghost" type="submit">
                Skip for now
              </Button>
            </form>
            <form action={advanceOnboardingAction}>
              <input type="hidden" name="step" value="5" />
              <Button type="submit">Continue</Button>
            </form>
          </div>
        </div>
      ) : null}

      {step === 5 && workspace ? (
        <Card>
          <CardHeader>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Rocket className="h-5 w-5" />
            </span>
            <CardTitle className="pt-2">Finish setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Workspace: {workspace.name}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Team members: {invitations.filter((i) => i.status === "accepted").length + 1}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${accounts.length ? "text-emerald-500" : "text-muted-foreground"}`} />
                Social accounts: {accounts.length ? `${accounts.length} connected` : skipped.has(3) ? "Skipped" : "Not connected"}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${discordIntegration ? "text-emerald-500" : "text-muted-foreground"}`} />
                Discord: {discordIntegration ? "Connected" : skipped.has(4) ? "Skipped" : "Not connected"}
              </li>
            </ul>
            <form action={completeOnboardingAction}>
              <Button type="submit" className="w-full">
                Complete onboarding
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Completing onboarding marks this workspace ready. You can change everything later in Settings.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
