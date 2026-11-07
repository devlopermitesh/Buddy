import Link from "next/link";
import { Bot, Play, Plus, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { runAutomationRuleAction, toggleAutomationRuleAction } from "@/lib/actions/automation";
import { formatDateTime, relativeTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateAutomationRuleForm, EditAutomationRuleForm } from "@/components/automation/automation-forms";

export default async function AutomationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AUTOMATION_MANAGE);
  const [rules, runs, pendingRecommendations] = await Promise.all([
    db.automationRule.findMany({ where: { workspaceId: ctx.workspace.id }, orderBy: { createdAt: "desc" } }),
    db.automationRun.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { rule: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    db.aiRecommendation.count({ where: { workspaceId: ctx.workspace.id, status: "suggested" } }),
  ]);

  const enabled = rules.filter((rule) => rule.enabled).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Automation"
        description="Rules generate AI recommendations and tasks. They never publish or change a post without you accepting the suggestion."
        actions={
          <Button asChild variant="outline">
            <Link href={`/w/${slug}/ai-scheduling`}>
              <Sparkles className="h-4 w-4" /> AI suggestions ({pendingRecommendations})
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active rules" value={enabled} icon={Zap} tone="success" />
        <StatCard label="Total rules" value={rules.length} icon={Bot} />
        <StatCard label="Pending suggestions" value={pendingRecommendations} icon={Sparkles} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {rules.length === 0 ? (
            <EmptyState icon={Bot} title="No automation rules" description="Create your first rule to start generating suggestions." />
          ) : (
            rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {rule.name}
                      <Badge variant={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Enabled" : "Paused"}</Badge>
                    </CardTitle>
                    <span className="text-xs capitalize text-muted-foreground">{rule.ruleType.replaceAll("_", " ")}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="max-h-28 overflow-auto rounded-md bg-muted p-2 text-xs text-muted-foreground">{rule.configuration}</pre>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={toggleAutomationRuleAction}>
                      <input type="hidden" name="workspaceSlug" value={slug} />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <Button type="submit" size="sm" variant="outline">
                        {rule.enabled ? "Pause" : "Enable"}
                      </Button>
                    </form>
                    <form action={runAutomationRuleAction}>
                      <input type="hidden" name="workspaceSlug" value={slug} />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <Button type="submit" size="sm">
                        <Play className="h-3.5 w-3.5" /> Run now
                      </Button>
                    </form>
                    <span className="text-xs text-muted-foreground">Last updated {relativeTime(rule.updatedAt)}</span>
                  </div>
                  <details className="rounded-md border border-border p-2.5">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Edit rule</summary>
                    <div className="mt-3">
                      <EditAutomationRuleForm
                        slug={slug}
                        rule={{ id: rule.id, name: rule.name, configuration: rule.configuration, enabled: rule.enabled }}
                      />
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" /> New rule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CreateAutomationRuleForm slug={slug} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="space-y-1 rounded-md border border-border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{run.rule.name}</span>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                      {run.error ? ` · ${truncate(run.error, 60)}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
