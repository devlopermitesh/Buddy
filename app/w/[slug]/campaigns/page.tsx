import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateCampaignForm } from "@/components/campaigns/campaign-forms";

export default async function CampaignsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.CAMPAIGNS_MANAGE);
  const campaigns = await db.campaign.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { posts: { select: { status: true } }, tasks: { select: { status: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Campaigns"
        description="Group posts and tasks around a launch or theme."
        actions={
          ctx.can(PERMISSIONS.CAMPAIGNS_MANAGE) ? (
            <Button asChild variant="outline">
              <Link href={`/w/${slug}/content-studio/new`}>
                <Plus className="h-4 w-4" /> New post
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No campaigns yet" description="Create a campaign to organise your content." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {campaigns.map((campaign) => {
                const published = campaign.posts.filter((post) => post.status === "published").length;
                const openTasks = campaign.tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length;
                return (
                  <Card key={campaign.id} className="overflow-hidden">
                    <div className="h-1.5" style={{ backgroundColor: campaign.color ?? "#4f46e5" }} />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">
                          <Link href={`/w/${slug}/campaigns/${campaign.id}`} className="hover:underline">
                            {campaign.name}
                          </Link>
                        </CardTitle>
                        <Badge variant={campaign.status === "active" ? "success" : campaign.status === "archived" ? "neutral" : "info"}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {campaign.description ? <p className="line-clamp-2 text-muted-foreground">{campaign.description}</p> : null}
                      {campaign.goal ? <p className="text-xs text-muted-foreground">Goal: {campaign.goal}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        {campaign.startDate ? formatDate(campaign.startDate) : "No start"} → {campaign.endDate ? formatDate(campaign.endDate) : "No end"}
                      </p>
                      <div className="flex gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
                        <span>{campaign.posts.length} posts</span>
                        <span>{published} published</span>
                        <span>{openTasks} open tasks</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {ctx.can(PERMISSIONS.CAMPAIGNS_MANAGE) ? (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" /> New campaign
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CreateCampaignForm slug={slug} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
