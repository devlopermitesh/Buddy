import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import type { ReportData } from "@/lib/actions/reports";
import { formatDate, formatDateTime, formatNumber, parseJson, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton } from "@/components/reports/print-button";

export default async function ReportDetailPage({ params }: { params: Promise<{ slug: string; reportId: string }> }) {
  const { slug, reportId } = await params;
  const ctx = await getWorkspaceContext(slug, PERMISSIONS.REPORTS_VIEW);
  const report = await db.report.findFirst({ where: { id: reportId, workspaceId: ctx.workspace.id } });
  if (!report) notFound();
  const data = parseJson<ReportData | null>(report.data, null);

  const totals = data?.totals;
  const engagementRate = totals && totals.impressions > 0 ? (totals.engagement / totals.impressions) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/w/${slug}/reports`}>
            <ArrowLeft className="h-4 w-4" /> Reports
          </Link>
        </Button>
        <PrintButton />
      </div>

      <PageHeader
        eyebrow="Report"
        title={`${titleCase(report.type)} performance report`}
        description={`${formatDate(report.periodStart)} – ${formatDate(report.periodEnd)} · generated ${formatDateTime(report.createdAt)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Reach", value: totals?.reach ?? 0 },
          { label: "Impressions", value: totals?.impressions ?? 0 },
          { label: "Engagements", value: totals?.engagement ?? 0 },
          { label: "Engagement rate", value: `${engagementRate.toFixed(1)}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold">{typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By platform</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.byPlatform.length === 0 ? (
              <p className="text-sm text-muted-foreground">No platform data.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byPlatform.map((row) => (
                    <TableRow key={row.platform}>
                      <TableCell>
                        <Badge variant={row.platform === "instagram" ? "violet" : "info"}>{titleCase(row.platform)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.reach)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.engagement)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metric detail</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              { label: "Likes", value: totals?.likes ?? 0 },
              { label: "Comments", value: totals?.comments ?? 0 },
              { label: "Shares", value: totals?.shares ?? 0 },
              { label: "Saves", value: totals?.saves ?? 0 },
              { label: "Clicks", value: totals?.clicks ?? 0 },
              { label: "Video views", value: totals?.videoViews ?? 0 },
            ].map((metric) => (
              <div key={metric.label}>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="font-medium">{formatNumber(metric.value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top posts</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts in this report.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPosts.map((post) => (
                  <TableRow key={`${post.postId}-${post.platform}`}>
                    <TableCell>
                      <Link href={`/w/${slug}/content-studio/${post.postId}`} className="font-medium hover:underline">
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell>{titleCase(post.platform)}</TableCell>
                    <TableCell className="text-right">{formatNumber(post.reach)}</TableCell>
                    <TableCell className="text-right">{formatNumber(post.engagement)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
