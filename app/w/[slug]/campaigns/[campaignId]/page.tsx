import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, CheckSquare, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { archiveCampaignAction, updateCampaignAction } from "@/lib/actions/tasks";
import { formatDate, formatDateTime, truncate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ slug: string; campaignId: string }> }) {
  const { slug, campaignId } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.CAMPAIGNS_MANAGE);
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId: ctx.workspace.id },
    include: {
      creator: true,
      posts: { include: { targets: true }, orderBy: { createdAt: "desc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!campaign) notFound();

  const published = campaign.posts.filter((post) => post.status === "published").length;
  const openTasks = campaign.tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length;
  const canManage = ctx.can(PERMISSIONS.CAMPAIGNS_MANAGE);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/w/${slug}/campaigns`}>
          <ArrowLeft className="h-4 w-4" /> Campaigns
        </Link>
      </Button>

      <PageHeader
        eyebrow="Campaign"
        title={campaign.name}
        description={campaign.description ?? `Created by ${campaign.creator.fullName}`}
        actions={
          canManage && campaign.status !== "archived" ? (
            <form action={archiveCampaignAction}>
              <input type="hidden" name="workspaceSlug" value={slug} />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button type="submit" variant="outline">
                <Archive className="h-4 w-4" /> Archive
              </Button>
            </form>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Status" value={campaign.status} />
        <StatCard label="Posts" value={campaign.posts.length} icon={FileText} />
        <StatCard label="Published" value={published} icon={FileText} tone="success" />
        <StatCard label="Open tasks" value={openTasks} icon={CheckSquare} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.posts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts in this campaign yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Targets</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <Link href={`/w/${slug}/content-studio/${post.id}`} className="text-sm font-medium hover:underline">
                            {post.title ?? truncate(post.baseCaption, 50) ?? "Untitled"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={post.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{post.targets.length}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(post.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaign.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks linked to this campaign.</p>
              ) : (
                campaign.tasks.map((task) => (
                  <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.assignee?.fullName ?? "Unassigned"} · {task.dueAt ? `due ${formatDate(task.dueAt)}` : "no due date"}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form action={updateCampaignAction} className="space-y-3">
                <input type="hidden" name="workspaceSlug" value={slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" name="name" defaultValue={campaign.name} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea id="edit-description" name="description" defaultValue={campaign.description ?? ""} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    name="status"
                    defaultValue={campaign.status}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-start">Start</Label>
                    <Input id="edit-start" name="startDate" type="date" defaultValue={dateInput(campaign.startDate)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-end">End</Label>
                    <Input id="edit-end" name="endDate" type="date" defaultValue={dateInput(campaign.endDate)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-goal">Goal</Label>
                  <Input id="edit-goal" name="goal" defaultValue={campaign.goal ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-color">Color</Label>
                  <Input id="edit-color" name="color" type="color" defaultValue={campaign.color ?? "#4f46e5"} className="h-9 p-1" />
                </div>
                <Button type="submit" className="w-full">
                  Save changes
                </Button>
              </form>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span> <Badge>{campaign.status}</Badge>
                </div>
                <p>
                  <span className="text-muted-foreground">Dates:</span> {campaign.startDate ? formatDate(campaign.startDate) : "—"} →{" "}
                  {campaign.endDate ? formatDate(campaign.endDate) : "—"}
                </p>
                {campaign.goal ? <p className="text-muted-foreground">Goal: {campaign.goal}</p> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
