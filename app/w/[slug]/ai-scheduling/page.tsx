import Link from "next/link";
import { CalendarClock, Check, Clock, Sparkles, X } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { acceptRecommendationAction, dismissRecommendationAction, runAutomationRuleAction } from "@/lib/actions/automation";
import { formatDateTime, parseJson, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSlotHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalised = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalised} ${suffix}`;
}

type Payload = {
  suggestedTime?: string;
  reasoning?: string;
  confidence?: number;
  headline?: string;
  detail?: string;
  title?: string;
  count?: number;
  posts?: { id: string; title: string; platform: string; error?: string }[];
};

export default async function AiSchedulingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.AI_SCHEDULE);
  const [recommendations, decided, rules, slots, accounts, snapshots, upcomingTargets] = await Promise.all([
    db.aiRecommendation.findMany({
      where: { workspaceId: ctx.workspace.id, status: "suggested" },
      include: { postTarget: { include: { post: true, socialAccount: true } }, socialAccount: true },
      orderBy: { createdAt: "desc" },
    }),
    db.aiRecommendation.findMany({
      where: { workspaceId: ctx.workspace.id, status: { in: ["accepted", "dismissed"] } },
      orderBy: { decidedAt: "desc" },
      take: 8,
    }),
    db.automationRule.findMany({
      where: { workspaceId: ctx.workspace.id, ruleType: { in: ["best_time", "queue_optimization", "content_gap_detection", "performance_insights"] }, enabled: true },
    }),
    db.postingSlot.findMany({ where: { workspaceId: ctx.workspace.id, isActive: true }, include: { socialAccount: true }, orderBy: [{ dayOfWeek: "asc" }, { slotTime: "asc" }] }),
    db.socialAccount.findMany({ where: { workspaceId: ctx.workspace.id, status: "active" } }),
    db.analyticsDaily.findMany({
      where: { workspaceId: ctx.workspace.id, metricDate: { gte: new Date(Date.now() - 30 * 86400000) } },
      include: { postTarget: true },
    }),
    db.postTarget.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        status: { in: ["scheduled", "queued"] },
        scheduledAt: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
      },
      select: { scheduledAt: true },
    }),
  ]);

  const bySlot = new Map<string, { day: number; hour: number; engagement: number; count: number }>();
  for (const snapshot of snapshots) {
    const publishedAt = snapshot.postTarget.publishedAt;
    if (!publishedAt) continue;
    const day = publishedAt.getDay();
    const hour = publishedAt.getHours();
    const key = `${day}-${hour}`;
    const slot = bySlot.get(key) ?? { day, hour, engagement: 0, count: 0 };
    slot.engagement += snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves + snapshot.clicks;
    slot.count += 1;
    bySlot.set(key, slot);
  }
  const bestSlots = [...bySlot.values()]
    .sort((a, b) => b.engagement / b.count - a.engagement / a.count)
    .slice(0, 3);

  const scheduledDays = new Set(
    upcomingTargets
      .map((target) => target.scheduledAt)
      .filter((date): date is Date => Boolean(date))
      .map((date) => date.toISOString().slice(0, 10)),
  );
  const contentGaps: { label: string; date: Date }[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const date = new Date(Date.now() + i * 86400000);
    const key = date.toISOString().slice(0, 10);
    if (!scheduledDays.has(key)) {
      contentGaps.push({
        label: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(date),
        date,
      });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Automation"
        title="AI scheduling"
        description="Recommendations are generated from your workspace data. Nothing changes until you accept it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/w/${slug}/automation`}>Manage rules</Link>
            </Button>
            {rules.length > 0 ? (
              <form action={runAutomationRuleAction}>
                <input type="hidden" name="workspaceSlug" value={slug} />
                <input type="hidden" name="ruleId" value={rules[0].id} />
                <Button type="submit">
                  <Sparkles className="h-4 w-4" /> Generate suggestions
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {recommendations.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No suggestions right now"
              description="Generate suggestions from an enabled automation rule, or check back after your next posts publish."
            />
          ) : (
            recommendations.map((recommendation) => {
              const payload = parseJson<Payload>(recommendation.payload, {});
              const confidence = Math.round((payload.confidence ?? 0.75) * 100);
              return (
                <Card key={recommendation.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        {recommendation.type.replaceAll("_", " ")}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">{relativeTime(recommendation.createdAt)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {payload.headline ? <p className="text-sm font-medium">{payload.headline}</p> : null}
                    {payload.suggestedTime ? (
                      <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        <CalendarClock className="h-4 w-4 text-primary" /> Suggested time:{" "}
                        <span className="font-medium">{formatDateTime(payload.suggestedTime)}</span>
                      </p>
                    ) : null}
                    {payload.title ? <p className="text-sm font-medium">{payload.title}</p> : null}
                    <p className="text-sm text-muted-foreground">{payload.reasoning ?? payload.detail ?? "Review this suggestion."}</p>
                    {payload.posts && payload.posts.length > 0 ? (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {payload.posts.map((post) => (
                          <li key={post.id}>
                            <Link href={`/w/${slug}/content-studio/${post.id}`} className="font-medium text-primary hover:underline">
                              {post.title}
                            </Link>{" "}
                            · {post.platform}
                            {post.error ? ` — ${post.error}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {recommendation.postTarget ? (
                      <p className="text-xs text-muted-foreground">
                        Target:{" "}
                        <Link href={`/w/${slug}/content-studio/${recommendation.postTarget.postId}`} className="font-medium text-primary hover:underline">
                          {recommendation.postTarget.post.title ?? "Untitled post"}
                        </Link>{" "}
                        · {recommendation.postTarget.socialAccount.accountName}
                      </p>
                    ) : null}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Confidence</span>
                        <span>{confidence}%</span>
                      </div>
                      <Progress value={confidence} />
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <form action={acceptRecommendationAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="recommendationId" value={recommendation.id} />
                        <Button type="submit" size="sm">
                          <Check className="h-3.5 w-3.5" /> Accept
                        </Button>
                      </form>
                      <form action={dismissRecommendationAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="recommendationId" value={recommendation.id} />
                        <Button type="submit" size="sm" variant="outline">
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historical engagement</CardTitle>
              <p className="text-xs text-muted-foreground">Best performing times from the last 30 days.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {bestSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough published data yet.</p>
              ) : (
                bestSlots.map((slot, index) => (
                  <div key={`${slot.day}-${slot.hour}`} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                    <div>
                      <p className="text-sm font-medium">
                        {DAYS[slot.day]} · {formatSlotHour(slot.hour)}
                      </p>
                      <p className="text-xs text-muted-foreground">{slot.count} published post{slot.count === 1 ? "" : "s"}</p>
                    </div>
                    <Badge variant={index === 0 ? "success" : "outline"}>
                      {Math.round(slot.engagement / Math.max(slot.count, 1))} eng/post
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content gap suggestions</CardTitle>
              <p className="text-xs text-muted-foreground">Days in the next 10 with nothing scheduled.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {contentGaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your calendar is covered for the next 10 days.</p>
              ) : (
                contentGaps.slice(0, 5).map((gap) => (
                  <div key={gap.date.toISOString()} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                    <span className="text-sm">{gap.label}</span>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/w/${slug}/content-studio/new`}>Fill gap</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Posting slots
              </CardTitle>
              <p className="text-xs text-muted-foreground">Default times used when you accept a schedule suggestion.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {accounts.map((account) => {
                const accountSlots = slots.filter((slot) => slot.socialAccountId === account.id);
                return (
                  <div key={account.id}>
                    <p className="mb-1 text-sm font-medium">{account.accountName}</p>
                    {accountSlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No slots configured.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {accountSlots.map((slot) => (
                          <Badge key={slot.id} variant="outline">
                            {DAYS[slot.dayOfWeek]} {slot.slotTime}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent decisions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {decided.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decisions yet.</p>
              ) : (
                decided.map((recommendation) => (
                  <div key={recommendation.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                    <span className="min-w-0 truncate capitalize">{recommendation.type.replaceAll("_", " ")}</span>
                    <Badge variant={recommendation.status === "accepted" ? "success" : "neutral"}>{recommendation.status}</Badge>
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
